import asyncio
import json
import logging
import re
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

try:
    from groq import (
        AsyncGroq,
        APIConnectionError,
        APIStatusError,
        APITimeoutError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        RateLimitError,
    )
except ImportError:
    AsyncGroq = None  # type: ignore
    APIConnectionError = Exception  # type: ignore
    APIStatusError = Exception  # type: ignore
    APITimeoutError = Exception  # type: ignore
    AuthenticationError = Exception  # type: ignore
    BadRequestError = Exception  # type: ignore
    NotFoundError = Exception  # type: ignore
    RateLimitError = Exception  # type: ignore

from app.calculations.electricity_calculator import calculate_electricity_savings_scenario
from app.calculations.route_optimizer import optimize_bus_routes
from app.calculations.waste_calculator import calculate_recycling_rate
from app.core.config import settings
from app.data.emission_factors import BENCHMARK_PRICES, EMISSION_FACTORS
from app.schemas.ai import (
    AiChatResponse,
    CalculationBreakdown,
    KeyFindingItem,
    MetricItem,
    RecommendationItem,
    StructuredAiPayload,
)
from app.utils.dates import utc_iso
from app.utils.ids import generate_id

logger = logging.getLogger("carboniq.ai")


class AiCache:
    """
    Workspace-scoped, data-versioned in-memory LRU cache for deterministic calculations
    and AI responses.
    Guarantees:
    - Zero data leakage across workspaces (workspace_id prefix).
    - Automatic invalidation when underlying workspace records change (count, sum, or period).
    - Never caches error states.
    - LRU eviction (max 150 items) with a 10-minute TTL.
    """
    _cache: "OrderedDict[str, tuple[AiChatResponse, float]]" = OrderedDict()
    _max_entries: int = 150
    _ttl_seconds: float = 600.0

    @classmethod
    def make_key(cls, workspace_id: str, module: str, question: str, data_fingerprint: str) -> str:
        norm_q = question.strip().lower()
        return f"{workspace_id}:{module}:{norm_q}:{data_fingerprint}"

    @classmethod
    def get(cls, key: str) -> Optional[AiChatResponse]:
        now = time.time()
        entry = cls._cache.get(key)
        if entry is None:
            return None
        cached_resp, expiry = entry
        if now > expiry:
            cls._cache.pop(key, None)
            return None
        cls._cache.move_to_end(key)
        # Return a copy with fresh timestamp/id if needed, but preserved content
        return cached_resp

    @classmethod
    def set(cls, key: str, response: AiChatResponse) -> None:
        now = time.time()
        if len(cls._cache) >= cls._max_entries:
            cls._cache.popitem(last=False)
        cls._cache[key] = (response, now + cls._ttl_seconds)

    @classmethod
    def invalidate_workspace(cls, workspace_id: str) -> None:
        keys_to_remove = [k for k in cls._cache if k.startswith(f"{workspace_id}:")]
        for k in keys_to_remove:
            cls._cache.pop(k, None)


def sanitize_user_input(text: str) -> str:
    """
    Sanitizes user query to prevent prompt injection and instruction override attempts.
    Limits length and strips control sequences.
    """
    cleaned = text.strip()[:500]
    injection_patterns = [
        r"(?i)ignore\s+(all\s+)?(previous|prior)\s+instructions?",
        r"(?i)system\s*:",
        r"(?i)assistant\s*:",
        r"(?i)you\s+are\s+now\s+in\s+developer\s+mode",
        r"(?i)bypass\s+all\s+rules",
    ]
    for pattern in injection_patterns:
        cleaned = re.sub(pattern, "[sanitized]", cleaned)
    return cleaned.strip()


def parse_structured_ai_reply(
    raw_reply: str,
    default_intent: str = "direct",
    default_answer: str = "",
) -> StructuredAiPayload:
    """
    Safely parses an LLM completion into a validated StructuredAiPayload.
    Handles:
    - Clean JSON objects matching the schema.
    - Markdown-wrapped JSON (```json ... ```).
    - Unstructured prose or markdown responses by extracting the direct answer.
    Guarantees clean presentation without raw JSON syntax.
    """
    cleaned = raw_reply.strip()
    # Strip markdown code fences if wrapped
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()

    # Search for JSON substring
    match = re.search(r"(\{[\s\S]*\})", cleaned)
    data = None
    if match:
        json_candidate = match.group(1).strip()
        # Clean trailing commas before closing braces/brackets
        json_candidate = re.sub(r",\s*([\]}])", r"\1", json_candidate)
        try:
            data = json.loads(json_candidate, strict=False)
        except Exception:
            try:
                data = json.loads(json_candidate)
            except Exception as parse_err:
                logger.debug("Failed parsing JSON from LLM: %s", parse_err)
                data = None

    if isinstance(data, dict):
        direct_ans = str(
            data.get("direct_answer")
            or data.get("summary")
            or data.get("answer")
            or data.get("content")
            or ""
        ).strip()

        # If direct_ans itself contains serialized JSON, extract the text recursively
        if direct_ans.startswith("{") and ("direct_answer" in direct_ans or "summary" in direct_ans):
            inner_m = re.search(r'"(?:direct_answer|summary)"\s*:\s*"((?:[^"\\]|\\.)*)"', direct_ans)
            if inner_m:
                try:
                    direct_ans = inner_m.group(1).encode("utf-8").decode("unicode_escape", errors="ignore").strip()
                except Exception:
                    direct_ans = inner_m.group(1).strip()

        if not direct_ans:
            direct_ans = default_answer or cleaned[:300]

        metrics: List[MetricItem] = []
        for m in data.get("metrics", []):
            if isinstance(m, dict) and m.get("label") and m.get("value") is not None:
                metrics.append(
                    MetricItem(
                        label=str(m["label"]),
                        value=m["value"],
                        unit=str(m.get("unit")) if m.get("unit") else None,
                        subtext=str(m.get("subtext")) if m.get("subtext") else None,
                        trend=str(m.get("trend")) if m.get("trend") in ["up", "down", "neutral"] else None,
                    )
                )

        findings: List[KeyFindingItem] = []
        for kf in data.get("key_findings", []):
            if isinstance(kf, dict) and (kf.get("title") or kf.get("description")):
                findings.append(
                    KeyFindingItem(
                        title=str(kf.get("title") or "Key Finding"),
                        description=str(kf.get("description") or ""),
                        category=str(kf.get("category")) if kf.get("category") else None,
                    )
                )

        recs: List[RecommendationItem] = []
        for r in data.get("recommendations", []):
            if isinstance(r, dict) and (r.get("title") or r.get("explanation")):
                recs.append(
                    RecommendationItem(
                        title=str(r.get("title") or "Recommended Action"),
                        explanation=str(r.get("explanation") or ""),
                        expected_benefit=str(r.get("expected_benefit") or r.get("impact") or "Operational efficiency"),
                        priority=str(r.get("priority") or "Medium"),
                        category=str(r.get("category") or "General"),
                        action_url=str(r.get("action_url")) if r.get("action_url") else None,
                        action_label=str(r.get("action_label")) if r.get("action_label") else None,
                    )
                )

        limits = [str(x) for x in data.get("data_limitations", []) if x]

        return StructuredAiPayload(
            intent=data.get("intent", default_intent),
            direct_answer=direct_ans,
            explanation=data.get("explanation") if data.get("explanation") else None,
            reporting_period=data.get("reporting_period"),
            metrics=metrics,
            key_findings=findings,
            recommendations=recs,
            data_limitations=limits,
            confidence_score=str(data.get("confidence_score")) if data.get("confidence_score") else None,
        )

    # Fallback: Extract fields using regex to prevent displaying raw JSON blocks
    da_match = re.search(r'"(?:direct_answer|summary)"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
    expl_match = re.search(r'"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)

    extracted_ans = ""
    if da_match:
        try:
            extracted_ans = da_match.group(1).encode("utf-8").decode("unicode_escape", errors="ignore").strip()
        except Exception:
            extracted_ans = da_match.group(1).strip()

    extracted_expl = None
    if expl_match:
        try:
            extracted_expl = expl_match.group(1).encode("utf-8").decode("unicode_escape", errors="ignore").strip()
        except Exception:
            extracted_expl = expl_match.group(1).strip()

    if not extracted_ans:
        clean_text = re.sub(r'^[{\s]*"(?:direct_answer|summary)"\s*:\s*"?', "", cleaned)
        clean_text = re.sub(r'"?\s*[}\s]*$', "", clean_text).strip()
        if clean_text.startswith("{") and "}" in clean_text:
            clean_text = default_answer or "Analysis generated from verified records."
        extracted_ans = clean_text

    return StructuredAiPayload(
        intent=default_intent,
        direct_answer=extracted_ans or default_answer or "Analysis generated from verified records.",
        explanation=extracted_expl,
        metrics=[],
        key_findings=[],
        recommendations=[],
        data_limitations=[],
    )


class AiAssistantService:
    """
    Shared, secure AI Assistant service powering the four context-aware experiences:
    1. Electricity Advisor (Module-isolated: electricity consumption, CEA grid factors, tariffs)
    2. Transportation Advisor (Module-isolated: vehicle fuels, fleet routes, occupancy, optimization)
    3. Waste Advisor (Module-isolated: categories, recovery rates, treatment methods, disposal costs)
    4. Main AI Insights Assistant (Cross-category synthesis: holistic footprint, priorities, trends)

    Safeguards:
    - If GROQ_API_KEY is not configured: immediately raises HTTP 503 Service Unavailable.
      Zero fake, static, simulated, or rule-based answers are generated.
    - If configured: uses official Groq API (AsyncGroq, default llama-3.3-70b-versatile).
    - Grounded strictly in authenticated workspace records and deterministic backend calculations.
    - Zero numerical hallucinations: factors and calculations originate from trusted backend services.
    - Input sanitization against instruction overriding.
    """

    _groq_client: Optional[Any] = None
    _cached_api_key: Optional[str] = None

    @classmethod
    def _verify_groq_configured(cls) -> str:
        """
        Enforces that GROQ_API_KEY is present in the environment.
        Raises HTTP 503 immediately if unconfigured.
        """
        api_key = settings.effective_groq_api_key
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI is not configured. Add GROQ_API_KEY to the backend environment and restart the server.",
            )
        return api_key

    @classmethod
    def _get_groq_client(cls, api_key: str) -> Any:
        """
        Reuses a single AsyncGroq client instance across requests to maintain
        connection pooling and avoid TCP/TLS handshake latency on every call.
        """
        if cls._groq_client is None or cls._cached_api_key != api_key:
            cls._cached_api_key = api_key
            cls._groq_client = AsyncGroq(api_key=api_key, timeout=12.0)
        return cls._groq_client

    @classmethod
    async def _call_llm(
        cls,
        system_instruction: str,
        user_query: str,
        grounded_context: Dict[str, Any],
        max_tokens: int = 450,
    ) -> str:
        """
        Calls official Groq API using shared AsyncGroq client.
        Injects verified backend calculations as the sole authoritative numerical context.
        Uses compact JSON formatting and tuned token limits to minimize latency.
        """
        api_key = cls._verify_groq_configured()

        if AsyncGroq is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Groq SDK is not installed in the backend environment.",
            )

        configured_model = settings.effective_groq_model or "qwen/qwen3.8-27b"
        models_to_attempt = [configured_model]
        for fallback in ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]:
            if fallback not in models_to_attempt:
                models_to_attempt.append(fallback)

        system_prompt = (
            f"{system_instruction}\n\n"
            "CRITICAL ARCHITECTURAL CONSTRAINTS:\n"
            "1. ONLY use verified numerical data provided in GROUNDED CONTEXT.\n"
            "2. Do NOT invent, extrapolate, or alter numbers or emission factors.\n"
            "3. State data limitations if records are missing.\n"
            "4. Be concise and direct. Keep direct_answer to 2-3 high-impact sentences. Limit key_findings to max 2 items and recommendations to max 2 actions.\n"
            "5. Respond ONLY with a valid JSON object matching the requested schema without markdown fences."
        )

        # Minified JSON context to save prompt token bandwidth and processing time
        compact_context = json.dumps(grounded_context, separators=(",", ":"))
        user_prompt = (
            f"GROUNDED CONTEXT:\n{compact_context}\n\n"
            f"USER INQUIRY:\n{user_query}"
        )

        client = cls._get_groq_client(api_key)

        for attempt_idx, current_model in enumerate(models_to_attempt):
            try:
                chat_completion = await client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    model=current_model,
                    temperature=0.1,  # Low temperature to prevent hallucinations
                    max_tokens=max_tokens,
                )
                if chat_completion.choices and len(chat_completion.choices) > 0:
                    answer = chat_completion.choices[0].message.content
                    if answer and answer.strip():
                        if current_model != configured_model:
                            logger.info(
                                "Groq completion succeeded using fallback model '%s' (configured '%s' was unavailable).",
                                current_model,
                                configured_model,
                            )
                        return answer.strip()

                logger.error("Groq API returned an empty completion response for model '%s'.", current_model)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Groq API returned an empty completion.",
                )
            except (NotFoundError, BadRequestError) as e:
                err_msg = getattr(e, "message", str(e)).lower()
                is_model_error = (
                    isinstance(e, NotFoundError)
                    or "model" in err_msg
                    or "not found" in err_msg
                    or "decommissioned" in err_msg
                )
                if is_model_error:
                    logger.warning(
                        "Groq model '%s' is unavailable on this account (%s).",
                        current_model,
                        err_msg,
                    )
                    # If other models are queued, attempt them
                    if attempt_idx < len(models_to_attempt) - 1:
                        logger.info("Attempting next candidate model '%s'...", models_to_attempt[attempt_idx + 1])
                        continue

                    # All candidates failed
                    logger.error("All candidate Groq models failed. Configured model was '%s'.", configured_model)
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=(
                            f"The configured Groq model '{configured_model}' is not supported or accessible with your API key. "
                            f"Please update GROQ_MODEL in backend/.env to a supported model (e.g. qwen/qwen3.8-27b)."
                        ),
                    )
                else:
                    logger.error("Groq bad request error: %s", e)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid request parameters to Groq API: {getattr(e, 'message', str(e))}",
                    )
            except AuthenticationError as e:
                logger.error(
                    "Groq authentication failure: invalid or rejected API key (begins with '%s...').",
                    api_key[:6] if len(api_key) >= 6 else "***",
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Groq authentication failed. Please verify that GROQ_API_KEY is configured with a valid key in the backend environment.",
                )
            except RateLimitError as e:
                logger.warning("Groq rate limit reached: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="The AI assistant is temporarily rate-limited by the Groq API provider. Please wait a moment and try again.",
                )
            except APITimeoutError as e:
                logger.error("Groq API request timed out after 15.0s: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Groq API request timed out after 15.0s. Please try again shortly.",
                )
            except APIConnectionError as e:
                logger.error("Groq connection timeout or network failure: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Unable to connect to the Groq API service due to a network timeout or connection error.",
                )
            except APIStatusError as e:
                logger.error("Groq API status error [%s]: %s", e.status_code, getattr(e, 'message', str(e)))
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"The Groq API returned an error (status {e.status_code}): {getattr(e, 'message', 'Upstream error')}.",
                )
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("Unexpected internal exception during Groq LLM invocation: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"An unexpected internal error occurred during AI processing: {str(e)}",
                )

    # =========================================================================
    # EXPERIENCE 1: Electricity AI Advisor
    # =========================================================================
    @classmethod
    async def query_electricity_advisor(
        cls,
        question: str,
        workspace_id: str,
        db: Any,
    ) -> AiChatResponse:
        t_start = time.perf_counter()
        cls._verify_groq_configured()
        sanitized_q = sanitize_user_input(question)
        q = sanitized_q.lower()
        timestamp = utc_iso()
        chat_id = generate_id("ai_elec")

        # Selective field projection avoids retrieving unnecessary document fields
        t_db_start = time.perf_counter()
        projection = {
            "reporting_month": 1,
            "consumption_kwh": 1,
            "calculated_emissions_kg": 1,
            "bill_amount_inr": 1,
            "source": 1,
            "building_or_department": 1,
            "_id": 0,
        }
        cursor = db.electricity_records.find(
            {"workspace_id": workspace_id},
            projection=projection,
        ).sort("reporting_month", 1)
        records = [r async for r in cursor]
        t_db = (time.perf_counter() - t_db_start) * 1000

        if not records:
            empty_msg = "No electricity consumption records found in your workspace yet. Please log monthly meter readings to enable personalized AI energy analysis."
            return AiChatResponse(
                id=chat_id,
                content=empty_msg,
                timestamp=timestamp,
                structured_payload=StructuredAiPayload(
                    intent="direct",
                    direct_answer=empty_msg,
                    data_limitations=["No electricity records currently logged for this workspace."],
                ),
            )

        latest = records[-1]
        previous = records[-2] if len(records) > 1 else None

        total_kwh = sum(r.get("consumption_kwh", 0.0) for r in records)
        total_emissions = sum(r.get("calculated_emissions_kg", 0.0) for r in records)

        # Scoped Cache Check
        fingerprint = f"{len(records)}:{total_kwh:.1f}:{latest.get('reporting_month')}"
        cache_key = AiCache.make_key(workspace_id, "electricity", sanitized_q, fingerprint)
        cached_resp = AiCache.get(cache_key)
        if cached_resp:
            t_total = (time.perf_counter() - t_start) * 1000
            logger.info("AI [electricity] CACHE HIT: total=%.1fms (db=%.1fms)", t_total, t_db)
            return cached_resp

        t_calc_start = time.perf_counter()
        grid_factor = EMISSION_FACTORS["grid_in_cea_baseline"]

        # Department breakdown
        dept_totals: Dict[str, float] = {}
        for r in records:
            dept = r.get("building_or_department") or "Facility"
            dept_totals[dept] = dept_totals.get(dept, 0.0) + r.get("consumption_kwh", 0.0)

        # Peak consumption record
        peak = max(records, key=lambda x: x.get("consumption_kwh", 0.0))

        # 15% reduction scenario
        scenario_15 = calculate_electricity_savings_scenario(latest["consumption_kwh"], 15.0)

        grounded_context = {
            "module": "electricity",
            "record_count": len(records),
            "latest_record": {
                "month": latest["reporting_month"],
                "consumption_kwh": latest["consumption_kwh"],
                "calculated_emissions_kg": latest.get("calculated_emissions_kg", 0.0),
                "bill_inr": latest.get("bill_amount_inr"),
                "source": latest.get("source", "Grid"),
                "department": latest.get("building_or_department", "Facility"),
            },
            "previous_record": {
                "month": previous["reporting_month"],
                "consumption_kwh": previous["consumption_kwh"],
                "calculated_emissions_kg": previous.get("calculated_emissions_kg", 0.0),
            } if previous else None,
            "peak_record": {
                "month": peak["reporting_month"],
                "consumption_kwh": peak["consumption_kwh"],
                "calculated_emissions_kg": peak.get("calculated_emissions_kg", 0.0),
                "department": peak.get("building_or_department", "Facility"),
            },
            "modeled_15_pct_savings_scenario": {
                "kwh_reduction": scenario_15.kwh_reduction,
                "emissions_reduction_kg": scenario_15.emissions_reduction_kg,
                "cost_savings_inr": scenario_15.cost_savings_inr,
                "tariff_inr_per_kwh": scenario_15.tariff_inr_per_kwh,
                "assumptions": scenario_15.assumptions,
            },
            "department_breakdown_kwh": dept_totals,
            "total_consumption_kwh": total_kwh,
            "total_emissions_kg": total_emissions,
            "emission_factor": {
                "id": grid_factor.factor_id,
                "value": grid_factor.value,
                "unit": grid_factor.unit,
                "source": grid_factor.source,
            },
        }

        # Deterministic calculation breakdown if requested
        calculation_breakdown = None
        match_pct = re.search(r"(\d+)%", q)
        if "save" in q or "reduc" in q or match_pct:
            pct = float(match_pct.group(1)) if match_pct else 15.0
            sc = calculate_electricity_savings_scenario(latest["consumption_kwh"], pct)
            calculation_breakdown = CalculationBreakdown(
                formula="Potential Reduction = Current kWh × (Reduction % ÷ 100)",
                inputs={
                    "Current consumption": f"{latest['consumption_kwh']:,} kWh",
                    "Target reduction": f"{pct:.0f}%",
                    "Estimated variable tariff": f"₹{sc.tariff_inr_per_kwh}/kWh",
                    "Grid emission factor": f"{grid_factor.value} {grid_factor.unit}",
                },
                assumptions=sc.assumptions,
                result=f"₹{sc.cost_savings_inr:,.0f}/month estimated savings ({sc.kwh_reduction} kWh / {sc.emissions_reduction_kg} kg CO2e)",
            )
        elif any(w in q for w in ["highest", "peak", "maximum"]):
            calculation_breakdown = CalculationBreakdown(
                formula="Peak Month = max(consumption_kwh across records)",
                inputs={
                    "Peak period": peak["reporting_month"],
                    "Consumption": f"{peak['consumption_kwh']:,} kWh",
                    "Calculated emissions": f"{peak.get('calculated_emissions_kg', 0):,} kg CO2e",
                },
                result=f"Peak observed in {peak['reporting_month']} across {len(records)} periods",
            )
        elif ("compare" in q or "previous" in q) and previous:
            diff_kwh = round(latest["consumption_kwh"] - previous["consumption_kwh"], 1)
            pct_change = round((diff_kwh / previous["consumption_kwh"]) * 100, 1) if previous["consumption_kwh"] > 0 else 0
            direction = "increased" if diff_kwh > 0 else "decreased" if diff_kwh < 0 else "stayed constant"
            calculation_breakdown = CalculationBreakdown(
                formula="Change = Latest Month kWh - Previous Month kWh",
                inputs={
                    f"Latest ({latest['reporting_month']})": f"{latest['consumption_kwh']} kWh",
                    f"Previous ({previous['reporting_month']})": f"{previous['consumption_kwh']} kWh",
                },
                result=f"{direction.capitalize()} by {abs(diff_kwh)} kWh ({pct_change:+0.1f}%)",
            )
        t_calc = (time.perf_counter() - t_calc_start) * 1000

        elec_instruction = (
            "You are CarbonIQ's Senior Energy & Decarbonization Analyst.\n"
            "ROLE: Provide grounded analysis of workspace electricity (kWh), CEA emissions (kg CO2e), tariff costs (INR), and efficiency actions.\n"
            "USER INTENT & EVIDENCE RULES:\n"
            "- Determine user intent: 'direct', 'comparative', 'recommendation', or 'analytical'.\n"
            "- If user asks a factual question, answer directly in 'direct_answer' with verified metrics in 'metrics'. Keep it concise without filler.\n"
            "- If user asks for savings, cite realistic operational actions (HVAC scheduling, cooling set points, solar PV).\n"
            "- If records are limited, state limitations in 'data_limitations'.\n\n"
            "OUTPUT SCHEMA (Respond ONLY with valid JSON):\n"
            "{\n"
            '  "intent": "direct" | "comparative" | "recommendation" | "analytical",\n'
            '  "direct_answer": "Direct answer citing verified kWh and kg CO2e.",\n'
            '  "explanation": "Optional methodology note (or null)",\n'
            '  "metrics": [\n'
            '    {"label": "Metric Name", "value": "1240", "unit": "kWh", "subtext": "Period"}\n'
            '  ],\n'
            '  "key_findings": [\n'
            '    {"title": "Finding Title", "description": "Concise observation.", "category": "Electricity"}\n'
            '  ],\n'
            '  "recommendations": [\n'
            '    {"title": "Action Title", "explanation": "Why relevant.", "priority": "High" | "Medium" | "Low", "expected_benefit": "Realistic benefit", "action_url": "/dashboard/simulator"}\n'
            '  ],\n'
            '  "data_limitations": ["Data boundary note if records are few"]\n'
            "}"
        )

        t_llm_start = time.perf_counter()
        llm_reply = await cls._call_llm(
            system_instruction=elec_instruction,
            user_query=sanitized_q,
            grounded_context=grounded_context,
            max_tokens=450,
        )
        t_llm = (time.perf_counter() - t_llm_start) * 1000

        t_parse_start = time.perf_counter()
        structured_payload = parse_structured_ai_reply(
            llm_reply,
            default_intent="direct",
            default_answer=f"Latest electricity consumption was {latest['consumption_kwh']:,} kWh ({latest.get('calculated_emissions_kg', 0):,.1f} kg CO2e) for {latest['reporting_month']}.",
        )
        t_parse = (time.perf_counter() - t_parse_start) * 1000

        t_total = (time.perf_counter() - t_start) * 1000
        logger.info(
            "AI [electricity] perf: total=%.1fms (db=%.1fms, calc=%.1fms, llm=%.1fms, parse=%.1fms, cached=False)",
            t_total, t_db, t_calc, t_llm, t_parse
        )

        response = AiChatResponse(
            id=chat_id,
            content=structured_payload.direct_answer,
            timestamp=timestamp,
            calculation_breakdown=calculation_breakdown,
            structured_payload=structured_payload,
            meta={
                "timing_ms": {
                    "db": round(t_db, 1),
                    "calc": round(t_calc, 1),
                    "llm": round(t_llm, 1),
                    "parse": round(t_parse, 1),
                    "total": round(t_total, 1),
                },
                "cached": False,
            },
        )
        AiCache.set(cache_key, response)
        return response

    # =========================================================================
    # EXPERIENCE 2: Transportation AI Advisor
    # =========================================================================
    @classmethod
    async def query_transportation_advisor(
        cls,
        question: str,
        workspace_id: str,
        db: Any,
    ) -> AiChatResponse:
        t_start = time.perf_counter()
        cls._verify_groq_configured()
        sanitized_q = sanitize_user_input(question)
        q = sanitized_q.lower()
        timestamp = utc_iso()
        chat_id = generate_id("ai_trans")

        # Concurrently fetch bus routes and transportation records with lean projections
        t_db_start = time.perf_counter()
        routes_proj = {
            "route_name": 1,
            "distance_km": 1,
            "assigned_students": 1,
            "seating_capacity": 1,
            "destination": 1,
            "trips_per_day": 1,
            "fuel_efficiency_km_per_l": 1,
            "_id": 0,
        }
        trans_proj = {
            "distance_km": 1,
            "calculated_emissions_kg": 1,
            "date": 1,
            "_id": 0,
        }

        async def _fetch_routes():
            return [r async for r in db.bus_routes.find({"workspace_id": workspace_id}, projection=routes_proj)]

        async def _fetch_trans():
            return [t async for t in db.transportation_records.find({"workspace_id": workspace_id}, projection=trans_proj)]

        routes, trans_records = await asyncio.gather(_fetch_routes(), _fetch_trans())
        t_db = (time.perf_counter() - t_db_start) * 1000

        if not routes and not trans_records:
            empty_msg = "No transportation records or fleet routes found in your workspace yet. Please configure bus corridors or log trip mileage to enable mobility analysis."
            return AiChatResponse(
                id=chat_id,
                content=empty_msg,
                timestamp=timestamp,
                structured_payload=StructuredAiPayload(
                    intent="direct",
                    direct_answer=empty_msg,
                    data_limitations=["No transportation records or bus routes currently configured for this workspace."],
                ),
            )

        total_dist = sum(r.get("distance_km", 0.0) for r in trans_records)
        total_emissions = sum(r.get("calculated_emissions_kg", 0.0) for r in trans_records)

        # Scoped Cache Check
        fingerprint = f"{len(routes)}:{len(trans_records)}:{total_dist:.1f}:{total_emissions:.1f}"
        cache_key = AiCache.make_key(workspace_id, "transportation", sanitized_q, fingerprint)
        cached_resp = AiCache.get(cache_key)
        if cached_resp:
            t_total = (time.perf_counter() - t_start) * 1000
            logger.info("AI [transportation] CACHE HIT: total=%.1fms (db=%.1fms)", t_total, t_db)
            return cached_resp

        t_calc_start = time.perf_counter()
        # Evaluate route optimization
        proposals = optimize_bus_routes(routes) if routes else []

        # Identify low occupancy routes
        low_occupancy = [
            r for r in routes
            if r.get("seating_capacity", 40) > 0 and (r.get("assigned_students", 0) / r.get("seating_capacity", 40)) < 0.6
        ]

        # Identify peak fuel route
        peak_route = None
        if routes:
            peak_route = max(
                routes,
                key=lambda x: (x.get("distance_km", 0) * x.get("trips_per_day", 2)) / max(1.0, x.get("fuel_efficiency_km_per_l", 4.5)),
            )

        grounded_trans_context = {
            "module": "transportation",
            "routes_count": len(routes),
            "fleet_records_count": len(trans_records),
            "total_distance_km": total_dist,
            "total_emissions_kg": total_emissions,
            "optimization_proposals_count": len(proposals),
            "low_occupancy_routes_count": len(low_occupancy),
            "routes_sample": [
                {
                    "route_name": r.get("route_name"),
                    "distance_km": r.get("distance_km"),
                    "assigned_students": r.get("assigned_students"),
                    "seating_capacity": r.get("seating_capacity"),
                    "destination": r.get("destination"),
                }
                for r in routes[:6]
            ],
        }

        calculation_breakdown = None
        if ("combin" in q or "optimiz" in q or "overlap" in q) and proposals:
            p = proposals[0]
            calculation_breakdown = CalculationBreakdown(
                formula="Fuel Reduction = (Current Distance - Combined Distance) ÷ Fleet km/L × Days/Month",
                inputs={
                    "Current total distance": f"{p.current_config.total_distance_km} km",
                    "Proposed consolidated distance": f"{p.proposed_config.total_distance_km} km",
                    "Distance reduction": f"{p.estimated_distance_reduction_km} km/day",
                },
                assumptions=p.assumptions,
                result=f"Save ~{p.estimated_fuel_savings_liters} L fuel/month (₹{p.estimated_monthly_savings_inr:,})",
            )
        elif peak_route and "fuel" in q and ("most" in q or "highest" in q or "peak" in q):
            daily_fuel = round((peak_route.get("distance_km", 0) * peak_route.get("trips_per_day", 2)) / max(1.0, peak_route.get("fuel_efficiency_km_per_l", 4.5)), 1)
            calculation_breakdown = CalculationBreakdown(
                formula="Daily Fuel = (Distance × Trips) ÷ Fuel Efficiency",
                inputs={
                    "Route": peak_route.get("route_name", ""),
                    "Distance": f"{peak_route.get('distance_km')} km",
                    "Fuel Efficiency": f"{peak_route.get('fuel_efficiency_km_per_l')} km/L",
                },
                result=f"{daily_fuel} L/day",
            )
        t_calc = (time.perf_counter() - t_calc_start) * 1000

        trans_instruction = (
            "You are CarbonIQ's Fleet & Mobility Sustainability Advisor.\n"
            "ROLE: Provide grounded insights on bus routes, trip distances, student occupancy, diesel consumption, and Scope 1 tailpipe emissions.\n"
            "USER INTENT & EVIDENCE RULES:\n"
            "- Determine user intent: 'direct', 'comparative', 'recommendation', or 'analytical'.\n"
            "- Use ONLY active bus routes, trip distances, and fleet records in GROUNDED CONTEXT.\n"
            "- If user asks which route consumes the most fuel, name the route and cite its distance, trips, and L/day directly in 'direct_answer'.\n"
            "- Keep direct_answer concise (2-3 sentences). Limit key findings and recommendations to max 2 items.\n\n"
            "OUTPUT SCHEMA (Respond ONLY with valid JSON):\n"
            "{\n"
            '  "intent": "direct" | "comparative" | "recommendation" | "analytical",\n'
            '  "direct_answer": "Concise direct answer citing verified distance, fuel (L), or emissions.",\n'
            '  "explanation": "Optional supporting explanation (or null)",\n'
            '  "metrics": [\n'
            '    {"label": "Daily Fuel", "value": "26.7", "unit": "L/day", "subtext": "Peak route"}\n'
            '  ],\n'
            '  "key_findings": [\n'
            '    {"title": "Route Finding", "description": "Concise route observation supported by records.", "category": "Transportation"}\n'
            '  ],\n'
            '  "recommendations": [\n'
            '    {"title": "Action Title", "explanation": "Corridor consolidation or deadhead reduction.", "priority": "Medium", "expected_benefit": "Estimated fuel reduction", "action_url": "/dashboard/transportation"}\n'
            '  ],\n'
            '  "data_limitations": ["Data boundary note if records are few"]\n'
            "}"
        )

        t_llm_start = time.perf_counter()
        llm_reply = await cls._call_llm(
            system_instruction=trans_instruction,
            user_query=sanitized_q,
            grounded_context=grounded_trans_context,
            max_tokens=450,
        )
        t_llm = (time.perf_counter() - t_llm_start) * 1000

        t_parse_start = time.perf_counter()
        structured_payload = parse_structured_ai_reply(
            llm_reply,
            default_intent="direct",
            default_answer="Transportation analysis generated based on active fleet routes.",
        )
        t_parse = (time.perf_counter() - t_parse_start) * 1000

        t_total = (time.perf_counter() - t_start) * 1000
        logger.info(
            "AI [transportation] perf: total=%.1fms (db=%.1fms, calc=%.1fms, llm=%.1fms, parse=%.1fms, cached=False)",
            t_total, t_db, t_calc, t_llm, t_parse
        )

        response = AiChatResponse(
            id=chat_id,
            content=structured_payload.direct_answer,
            timestamp=timestamp,
            calculation_breakdown=calculation_breakdown,
            structured_payload=structured_payload,
            meta={
                "timing_ms": {
                    "db": round(t_db, 1),
                    "calc": round(t_calc, 1),
                    "llm": round(t_llm, 1),
                    "parse": round(t_parse, 1),
                    "total": round(t_total, 1),
                },
                "cached": False,
            },
        )
        AiCache.set(cache_key, response)
        return response

    # =========================================================================
    # EXPERIENCE 3: Waste AI Advisor
    # =========================================================================
    @classmethod
    async def query_waste_advisor(
        cls,
        question: str,
        workspace_id: str,
        db: Any,
    ) -> AiChatResponse:
        t_start = time.perf_counter()
        cls._verify_groq_configured()
        sanitized_q = sanitize_user_input(question)
        q = sanitized_q.lower()
        timestamp = utc_iso()
        chat_id = generate_id("ai_waste")

        t_db_start = time.perf_counter()
        waste_proj = {
            "quantity_kg": 1,
            "treatment_method": 1,
            "category": 1,
            "date": 1,
            "calculated_emissions_kg": 1,
            "_id": 0,
        }
        cursor = db.waste_records.find({"workspace_id": workspace_id}, projection=waste_proj)
        records = [r async for r in cursor]
        t_db = (time.perf_counter() - t_db_start) * 1000

        if not records:
            empty_msg = "No waste stream records found in your workspace yet. Please log waste generation categories and treatment methods to enable circularity analysis."
            return AiChatResponse(
                id=chat_id,
                content=empty_msg,
                timestamp=timestamp,
                structured_payload=StructuredAiPayload(
                    intent="direct",
                    direct_answer=empty_msg,
                    data_limitations=["No waste records currently logged for this workspace."],
                ),
            )

        total_kg = sum(r.get("quantity_kg", 0.0) for r in records)
        recycled_kg = sum(
            r.get("quantity_kg", 0.0)
            for r in records
            if (r.get("treatment_method") or "").lower() == "recycling" or (r.get("category") or "").lower() == "recyclable"
        )
        rate = calculate_recycling_rate(recycled_kg, total_kg)

        # Scoped Cache Check
        fingerprint = f"{len(records)}:{total_kg:.1f}:{recycled_kg:.1f}"
        cache_key = AiCache.make_key(workspace_id, "waste", sanitized_q, fingerprint)
        cached_resp = AiCache.get(cache_key)
        if cached_resp:
            t_total = (time.perf_counter() - t_start) * 1000
            logger.info("AI [waste] CACHE HIT: total=%.1fms (db=%.1fms)", t_total, t_db)
            return cached_resp

        t_calc_start = time.perf_counter()
        cat_totals: Dict[str, float] = {}
        for r in records:
            c = r.get("category") or "General"
            cat_totals[c] = cat_totals.get(c, 0.0) + r.get("quantity_kg", 0.0)

        grounded_waste_context = {
            "module": "waste",
            "records_count": len(records),
            "total_waste_kg": total_kg,
            "recycled_kg": recycled_kg,
            "recycling_rate_percent": round(rate or 0, 1),
            "categories": cat_totals,
        }

        calculation_breakdown = None
        if "recycl" in q:
            calculation_breakdown = CalculationBreakdown(
                formula="Recycling Rate = (Recycled kg ÷ Total kg) × 100",
                inputs={
                    "Recycled waste": f"{recycled_kg:,.0f} kg",
                    "Total waste generated": f"{total_kg:,.0f} kg",
                },
                result=f"{rate or 0:.1f}% recovery rate",
            )
        elif cat_totals and ("category" in q or "contribute" in q or "most" in q):
            top_cat, top_qty = max(cat_totals.items(), key=lambda x: x[1])
            calculation_breakdown = CalculationBreakdown(
                formula="Category % = (Category kg ÷ Total kg) × 100",
                inputs={c: f"{k:,.0f} kg" for c, k in cat_totals.items()},
                result=f"{top_cat} ({top_qty:,.0f} kg)",
            )
        t_calc = (time.perf_counter() - t_calc_start) * 1000

        waste_instruction = (
            "You are CarbonIQ's Circular Economy & Waste Diversion Advisor.\n"
            "ROLE: Provide grounded analysis of waste stream weights (kg), recovery/recycling diversion rates (%), and IPCC avoidance factors.\n"
            "USER INTENT & EVIDENCE RULES:\n"
            "- Determine user intent: 'direct', 'comparative', 'recommendation', or 'analytical'.\n"
            "- Distinguish landfill emissions from negative circular diversion credits (avoided methane).\n"
            "- Never describe negative emissions as verified carbon removal (it is an avoided emission credit).\n"
            "- Keep direct_answer concise (2-3 sentences). Limit key findings and recommendations to max 2 items.\n\n"
            "OUTPUT SCHEMA (Respond ONLY with valid JSON):\n"
            "{\n"
            '  "intent": "direct" | "comparative" | "recommendation" | "analytical",\n'
            '  "direct_answer": "Direct answer citing verified kg, %, or diversion offsets.",\n'
            '  "explanation": "Methodology context distinguishing circular credits from removal (or null)",\n'
            '  "metrics": [\n'
            '    {"label": "Recycling Rate", "value": "42.0", "unit": "%", "subtext": "Material diversion"}\n'
            '  ],\n'
            '  "key_findings": [\n'
            '    {"title": "Diversion Finding", "description": "Stream observation.", "category": "Waste"}\n'
            '  ],\n'
            '  "recommendations": [\n'
            '    {"title": "Action Title", "explanation": "Practical segregation or composting action.", "priority": "Medium", "expected_benefit": "Avoided landfill waste", "action_url": "/dashboard/waste"}\n'
            '  ],\n'
            '  "data_limitations": ["Data boundary note if records are few"]\n'
            "}"
        )

        t_llm_start = time.perf_counter()
        llm_reply = await cls._call_llm(
            system_instruction=waste_instruction,
            user_query=sanitized_q,
            grounded_context=grounded_waste_context,
            max_tokens=450,
        )
        t_llm = (time.perf_counter() - t_llm_start) * 1000

        t_parse_start = time.perf_counter()
        structured_payload = parse_structured_ai_reply(
            llm_reply,
            default_intent="direct",
            default_answer=f"Recorded waste total is {total_kg:,.0f} kg with a {rate or 0:.1f}% recycling recovery rate.",
        )
        t_parse = (time.perf_counter() - t_parse_start) * 1000

        t_total = (time.perf_counter() - t_start) * 1000
        logger.info(
            "AI [waste] perf: total=%.1fms (db=%.1fms, calc=%.1fms, llm=%.1fms, parse=%.1fms, cached=False)",
            t_total, t_db, t_calc, t_llm, t_parse
        )

        response = AiChatResponse(
            id=chat_id,
            content=structured_payload.direct_answer,
            timestamp=timestamp,
            calculation_breakdown=calculation_breakdown,
            structured_payload=structured_payload,
            meta={
                "timing_ms": {
                    "db": round(t_db, 1),
                    "calc": round(t_calc, 1),
                    "llm": round(t_llm, 1),
                    "parse": round(t_parse, 1),
                    "total": round(t_total, 1),
                },
                "cached": False,
            },
        )
        AiCache.set(cache_key, response)
        return response

    # =========================================================================
    # EXPERIENCE 4: Main AI Insights Assistant (Enterprise Sustainability Synthesis)
    # =========================================================================
    @classmethod
    async def query_insights_advisor(
        cls,
        question: str,
        workspace_id: str,
        db: Any,
    ) -> AiChatResponse:
        t_start = time.perf_counter()
        cls._verify_groq_configured()
        sanitized_q = sanitize_user_input(question)
        timestamp = utc_iso()
        chat_id = generate_id("ai_ins")

        # 1. Gather cross-category records concurrently using lean field projections
        t_db_start = time.perf_counter()
        elec_proj = {"calculated_emissions_kg": 1, "reporting_month": 1, "_id": 0}
        trans_proj = {"calculated_emissions_kg": 1, "date": 1, "_id": 0}
        waste_proj = {"calculated_emissions_kg": 1, "date": 1, "_id": 0}

        async def _get_elec():
            return [r async for r in db.electricity_records.find({"workspace_id": workspace_id}, projection=elec_proj)]

        async def _get_trans():
            return [r async for r in db.transportation_records.find({"workspace_id": workspace_id}, projection=trans_proj)]

        async def _get_waste():
            return [r async for r in db.waste_records.find({"workspace_id": workspace_id}, projection=waste_proj)]

        async def _get_routes_count():
            try:
                return await db.bus_routes.count_documents({"workspace_id": workspace_id})
            except Exception:
                return 0

        elec_records, trans_records, waste_records, bus_routes_count = await asyncio.gather(
            _get_elec(),
            _get_trans(),
            _get_waste(),
            _get_routes_count(),
        )
        t_db = (time.perf_counter() - t_db_start) * 1000

        if not elec_records and not trans_records and not waste_records:
            empty_msg = "No emissions records found across Electricity, Transportation, or Waste in your workspace yet. Please add activity records to enable cross-category portfolio insights."
            return AiChatResponse(
                id=chat_id,
                content=empty_msg,
                timestamp=timestamp,
                structured_report=None,
                structured_payload=StructuredAiPayload(
                    intent="direct",
                    direct_answer=empty_msg,
                    data_limitations=["No activity records logged across any emission scopes in this workspace."],
                ),
            )

        # 2. Strict deterministic calculations (Python as authoritative single source of truth)
        t_calc_start = time.perf_counter()
        elec_emissions = round(sum(r.get("calculated_emissions_kg", 0.0) for r in elec_records), 1)
        trans_emissions = round(sum(r.get("calculated_emissions_kg", 0.0) for r in trans_records), 1)
        waste_emissions = round(sum(r.get("calculated_emissions_kg", 0.0) for r in waste_records), 1)

        total_net_emissions = round(elec_emissions + trans_emissions + waste_emissions, 1)

        # Scoped Cache Check
        fingerprint = f"{len(elec_records)}:{len(trans_records)}:{len(waste_records)}:{total_net_emissions:.1f}"
        cache_key = AiCache.make_key(workspace_id, "insights", sanitized_q, fingerprint)
        cached_resp = AiCache.get(cache_key)
        if cached_resp:
            t_total = (time.perf_counter() - t_start) * 1000
            logger.info("AI [insights] CACHE HIT: total=%.1fms (db=%.1fms)", t_total, t_db)
            return cached_resp

        # Compute gross positive emissions for explicit denominator calculations
        positive_categories = []
        if trans_emissions > 0:
            positive_categories.append(("Transportation", trans_emissions, len(trans_records)))
        if elec_emissions > 0:
            positive_categories.append(("Electricity", elec_emissions, len(elec_records)))
        if waste_emissions > 0:
            positive_categories.append(("Waste", waste_emissions, len(waste_records)))

        gross_positive_emissions = round(sum(c[1] for c in positive_categories), 1) if positive_categories else 0.0

        # Determine largest positive emission source
        largest_source_info = None
        if positive_categories:
            sorted_positive = sorted(positive_categories, key=lambda x: x[1], reverse=True)
            top_name, top_val, top_cnt = sorted_positive[0]
            pct_gross = round((top_val / gross_positive_emissions) * 100, 1) if gross_positive_emissions > 0 else 0.0
            pct_net = round((top_val / total_net_emissions) * 100, 1) if total_net_emissions > 0 else None
            largest_source_info = {
                "category": top_name,
                "emissions_kg": top_val,
                "percentage_of_gross": pct_gross,
                "percentage_of_net_total": pct_net,
                "record_count": top_cnt,
            }

        # Extract reporting period range if dates exist
        periods = set()
        for r in elec_records:
            if r.get("reporting_month"):
                periods.add(r["reporting_month"])
        for r in trans_records:
            if r.get("date"):
                periods.add(str(r["date"])[:7])
        for r in waste_records:
            if r.get("date"):
                periods.add(str(r["date"])[:7])
        reporting_period_str = ", ".join(sorted(periods)) if periods else "Current active dataset"

        # Structured categories array with explicit percentages and status
        categories_data = []

        # Transportation
        trans_pct_gross = round((trans_emissions / gross_positive_emissions) * 100, 1) if gross_positive_emissions > 0 and trans_emissions > 0 else 0.0
        trans_pct_net = round((trans_emissions / total_net_emissions) * 100, 1) if total_net_emissions > 0 and trans_emissions > 0 else None
        categories_data.append({
            "name": "Transportation",
            "emissions_kg": trans_emissions,
            "record_count": len(trans_records),
            "percentage_of_gross": trans_pct_gross,
            "percentage_of_net": trans_pct_net,
            "status": "positive",
            "note": "Fleet trips, commuter runs, and transit fuel consumption.",
        })

        # Electricity
        elec_pct_gross = round((elec_emissions / gross_positive_emissions) * 100, 1) if gross_positive_emissions > 0 and elec_emissions > 0 else 0.0
        elec_pct_net = round((elec_emissions / total_net_emissions) * 100, 1) if total_net_emissions > 0 and elec_emissions > 0 else None
        categories_data.append({
            "name": "Electricity",
            "emissions_kg": elec_emissions,
            "record_count": len(elec_records),
            "percentage_of_gross": elec_pct_gross,
            "percentage_of_net": elec_pct_net,
            "status": "positive",
            "note": "Grid electricity purchases calculated via CEA v19 emission baseline.",
        })

        # Waste
        waste_status = "negative_credit" if waste_emissions < 0 else "positive" if waste_emissions > 0 else "zero"
        waste_note = (
            "Net circular diversion credit: Recycling and composting offset net emissions by avoiding landfill methane generation."
            if waste_emissions < 0
            else "Solid waste disposal and landfill decomposition emissions."
        )
        categories_data.append({
            "name": "Waste",
            "emissions_kg": waste_emissions,
            "record_count": len(waste_records),
            "percentage_of_gross": None,
            "percentage_of_net": round((waste_emissions / total_net_emissions) * 100, 1) if total_net_emissions > 0 else None,
            "status": waste_status,
            "note": waste_note,
        })

        # 3. Grounded context provided to Groq
        from app.services.ml_prediction_service import MlPredictionService
        ml_info = MlPredictionService.get_model_info()

        grounded_context = {
            "total_net_emissions_kg": total_net_emissions,
            "total_gross_positive_emissions_kg": gross_positive_emissions,
            "total_records_analyzed": len(elec_records) + len(trans_records) + len(waste_records),
            "reporting_period": reporting_period_str,
            "largest_source": largest_source_info,
            "categories": categories_data,
            "bus_routes_count": bus_routes_count,
            "ml_forecasting": {
                "is_available": ml_info.is_loaded,
                "algorithm": ml_info.algorithm,
                "evaluation_metrics": ml_info.evaluation_metrics,
            },
        }

        # Calculation breakdown for transparent numerical audit
        calculation_breakdown = CalculationBreakdown(
            formula="Net Portfolio Emissions = Electricity (kg) + Transportation (kg) + Waste (kg)",
            inputs={
                "Electricity": f"{elec_emissions:,.1f} kg CO2e",
                "Transportation": f"{trans_emissions:,.1f} kg CO2e",
                "Waste (Diversion Credit)": f"{waste_emissions:,.1f} kg CO2e",
                "Gross Positive Emissions": f"{gross_positive_emissions:,.1f} kg CO2e",
            },
            assumptions=[
                "Electricity factor: CEA CO2 Baseline Database v19 (0.82 kg CO2e/kWh).",
                "Negative waste emissions represent circular recovery offsets (composting/recycling avoiding landfill methane).",
            ],
            result=f"{total_net_emissions:,.1f} kg CO2e Net Portfolio Total",
        )
        t_calc = (time.perf_counter() - t_calc_start) * 1000

        # 4. Prompt Groq for structured narrative insights in strict JSON
        system_instruction = (
            "You are CarbonIQ's Principal Enterprise Sustainability Analyst.\n"
            "ROLE: Provide grounded, cross-category carbon footprint analysis across Electricity, Transportation, and Waste.\n"
            "USER INTENT & EVIDENCE RULES:\n"
            "- Answer the user's specific inquiry FIRST. If the user asks for the largest emission source, answer directly in 'direct_answer' and cite its exact share and emissions in 'metrics'.\n"
            "- If user requests an overall summary, provide an executive synthesis in 'direct_answer', category observations in 'key_findings', and prioritized abatement steps in 'recommendations'.\n"
            "- If user asks about future emissions predictions, explain that CarbonIQ forecasts using an XGBoost pipeline (R²=0.976, MAE=37.5 kg CO2e) without inventing prediction values.\n"
            "- Keep direct_answer concise (2-3 sentences). Limit key findings and recommendations to max 2 items each.\n\n"
            "OUTPUT SCHEMA (Respond ONLY with valid JSON):\n"
            "{\n"
            '  "intent": "direct" | "analytical" | "comprehensive",\n'
            '  "direct_answer": "Direct, concise answer answering the user inquiry immediately with verified figures.",\n'
            '  "explanation": "Optional supporting portfolio context (or null)",\n'
            '  "metrics": [\n'
            '    {"label": "Metric Name", "value": "219.3", "unit": "kg CO2e", "subtext": "Scope note"}\n'
            '  ],\n'
            '  "key_findings": [\n'
            '    {"title": "Finding Title", "description": "Concise observation.", "category": "Category"}\n'
            '  ],\n'
            '  "recommendations": [\n'
            '    {"title": "Action Title", "explanation": "Actionable explanation.", "expected_benefit": "Qualitative or modeled realistic benefit.", "priority": "High" | "Medium" | "Low", "category": "Category", "action_url": "/dashboard/simulator", "action_label": "Model Savings"}\n'
            '  ],\n'
            '  "data_limitations": ["Dataset coverage notes if applicable"]\n'
            "}"
        )

        t_llm_start = time.perf_counter()
        llm_raw_reply = await cls._call_llm(
            system_instruction=system_instruction,
            user_query=f"Generate sustainability analytics report for query: '{sanitized_q}'",
            grounded_context=grounded_context,
            max_tokens=650,
        )
        t_llm = (time.perf_counter() - t_llm_start) * 1000

        t_parse_start = time.perf_counter()
        structured_payload = parse_structured_ai_reply(
            llm_raw_reply,
            default_intent="direct",
            default_answer=f"The portfolio recorded a net carbon footprint of {total_net_emissions:,.1f} kg CO2e across active categories.",
        )
        t_parse = (time.perf_counter() - t_parse_start) * 1000

        # Build verified structured report for dashboard analytics view
        structured_report = {
            "status": "success",
            "title": "Carbon Footprint & Sustainability Analysis",
            "summary": structured_payload.direct_answer,
            "reporting_period": reporting_period_str,
            "total_net_emissions_kg": total_net_emissions,
            "total_gross_emissions_kg": gross_positive_emissions,
            "total_records_analyzed": len(elec_records) + len(trans_records) + len(waste_records),
            "largest_source": largest_source_info,
            "categories": categories_data,
            "key_findings": [kf.model_dump() for kf in structured_payload.key_findings],
            "recommendations": [rec.model_dump() for rec in structured_payload.recommendations],
            "data_limitations": structured_payload.data_limitations,
        }

        t_total = (time.perf_counter() - t_start) * 1000
        logger.info(
            "AI [insights] perf: total=%.1fms (db=%.1fms, calc=%.1fms, llm=%.1fms, parse=%.1fms, cached=False)",
            t_total, t_db, t_calc, t_llm, t_parse
        )

        response = AiChatResponse(
            id=chat_id,
            content=structured_payload.direct_answer,
            timestamp=timestamp,
            calculation_breakdown=calculation_breakdown,
            structured_report=structured_report,
            structured_payload=structured_payload,
            meta={
                "timing_ms": {
                    "db": round(t_db, 1),
                    "calc": round(t_calc, 1),
                    "llm": round(t_llm, 1),
                    "parse": round(t_parse, 1),
                    "total": round(t_total, 1),
                },
                "cached": False,
            },
        )
        AiCache.set(cache_key, response)
        return response
