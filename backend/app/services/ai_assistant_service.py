import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from app.calculations.electricity_calculator import calculate_electricity_savings_scenario
from app.calculations.route_optimizer import optimize_bus_routes
from app.calculations.savings_calculator import simulate_transportation_savings
from app.calculations.waste_calculator import calculate_recycling_rate
from app.core.config import settings
from app.data.emission_factors import BENCHMARK_PRICES, EMISSION_FACTORS
from app.schemas.ai import AiChatResponse, CalculationBreakdown
from app.utils.dates import normalize_month, utc_iso
from app.utils.ids import generate_id

logger = logging.getLogger("carboniq.ai")


class AiAssistantService:
    @staticmethod
    async def query_electricity_advisor(
        question: str,
        workspace_id: str,
        db: Any,
    ) -> AiChatResponse:
        q = question.lower().strip()
        timestamp = utc_iso()
        chat_id = generate_id("ai_elec")

        # Load workspace electricity records
        cursor = db.electricity_records.find({"workspace_id": workspace_id}).sort("reporting_month", 1)
        records = []
        async for r in cursor:
            records.append(r)

        if not records:
            return AiChatResponse(
                id=chat_id,
                content=(
                    "No electricity records are available in your workspace yet. Please add a monthly record "
                    "using the 'Add record' button to enable calculated energy insights."
                ),
                timestamp=timestamp,
                suggested_follow_ups=["How can I log electricity consumption?", "What emission factors are used?"],
            )

        latest = records[-1]
        previous = records[-2] if len(records) > 1 else None

        # 1. Percentage reduction / savings scenario (e.g., 15% or regex)
        match_pct = re.search(r"(\d+)%", q)
        if "save" in q or "reduc" in q or match_pct:
            percent = float(match_pct.group(1)) if match_pct else 15.0
            scenario = calculate_electricity_savings_scenario(latest["consumption_kwh"], percent)
            return AiChatResponse(
                id=chat_id,
                content=(
                    f"Under a modeled **{percent:.0f}% electricity reduction** for your latest recorded period ({latest['reporting_month']}), "
                    f"your workspace would reduce approximately **{scenario.kwh_reduction} kWh**, cutting estimated monthly emissions "
                    f"by **{scenario.emissions_reduction_kg} kg CO2e** and saving around **₹{scenario.cost_savings_inr:,.0f}/month**."
                ),
                timestamp=timestamp,
                calculation_breakdown=CalculationBreakdown(
                    formula="Potential Reduction = Current kWh × (Reduction % ÷ 100)",
                    inputs={
                        "Current consumption": f"{latest['consumption_kwh']:,} kWh",
                        "Target reduction": f"{percent:.0f}%",
                        "Estimated variable tariff": f"₹{scenario.tariff_inr_per_kwh}/kWh",
                        "Grid emission factor": f"{EMISSION_FACTORS['grid_in_cea_baseline'].value} kg CO2e/kWh",
                    },
                    assumptions=scenario.assumptions,
                    result=f"₹{scenario.cost_savings_inr:,.0f}/month estimated savings ({scenario.kwh_reduction} kWh / {scenario.emissions_reduction_kg} kg CO2e)",
                ),
                suggested_follow_ups=[
                    "What actions can reduce my electricity emissions?",
                    "Compare this month with the previous month.",
                    "Which month had the highest electricity consumption?",
                ],
            )

        # 2. Peak / Highest month
        if any(w in q for w in ["highest", "peak", "maximum"]):
            peak = max(records, key=lambda x: x.get("consumption_kwh", 0))
            return AiChatResponse(
                id=chat_id,
                content=(
                    f"Your highest recorded consumption was in **{peak['reporting_month']}** at "
                    f"**{peak['consumption_kwh']:,} kWh**, generating **{peak.get('calculated_emissions_kg', 0):,} kg CO2e** emissions. "
                    f"Recorded bill was ₹{peak.get('bill_amount_inr', 0):,.0f} in {peak.get('building_or_department', 'the facility')}."
                ),
                timestamp=timestamp,
                calculation_breakdown=CalculationBreakdown(
                    formula="Peak Month = max(consumption_kwh across records)",
                    inputs={
                        "Peak period": peak["reporting_month"],
                        "Consumption": f"{peak['consumption_kwh']:,} kWh",
                        "Calculated emissions": f"{peak.get('calculated_emissions_kg', 0):,} kg CO2e",
                    },
                    result=f"Peak observed in {peak['reporting_month']} across {len(records)} periods",
                ),
                suggested_follow_ups=[
                    "Why is my electricity consumption increasing?",
                    "Which buildings or departments consume the most electricity?",
                    "How much can I save by reducing electricity usage by 15%?",
                ],
            )

        # 3. Compare with previous month
        if "compare" in q or "previous" in q:
            if not previous:
                return AiChatResponse(
                    id=chat_id,
                    content=(
                        f"Only 1 month ({latest['reporting_month']}: {latest['consumption_kwh']:,} kWh) is currently recorded. "
                        "Add a record for another month to enable comparative period analysis."
                    ),
                    timestamp=timestamp,
                )
            diff_kwh = round(latest["consumption_kwh"] - previous["consumption_kwh"], 1)
            pct_change = round((diff_kwh / previous["consumption_kwh"]) * 100, 1) if previous["consumption_kwh"] > 0 else 0
            direction = "increased" if diff_kwh > 0 else "decreased" if diff_kwh < 0 else "stayed constant"

            return AiChatResponse(
                id=chat_id,
                content=(
                    f"Comparing **{latest['reporting_month']}** ({latest['consumption_kwh']:,} kWh) to "
                    f"**{previous['reporting_month']}** ({previous['consumption_kwh']:,} kWh), consumption "
                    f"**{direction} by {abs(diff_kwh)} kWh ({abs(pct_change)}%)**."
                ),
                timestamp=timestamp,
                calculation_breakdown=CalculationBreakdown(
                    formula="Change = Latest Month kWh - Previous Month kWh",
                    inputs={
                        f"Latest ({latest['reporting_month']})": f"{latest['consumption_kwh']} kWh",
                        f"Previous ({previous['reporting_month']})": f"{previous['consumption_kwh']} kWh",
                    },
                    result=f"{direction.capitalize()} by {abs(diff_kwh)} kWh ({pct_change:+0.1f}%)",
                ),
                suggested_follow_ups=[
                    "Why is my electricity consumption increasing?",
                    "What actions can reduce my electricity emissions?",
                ],
            )

        # 4. Department breakdown
        if "department" in q or "building" in q:
            dept_totals: Dict[str, float] = {}
            for r in records:
                dept = r.get("building_or_department") or "Unassigned"
                dept_totals[dept] = dept_totals.get(dept, 0.0) + r.get("consumption_kwh", 0.0)
            sorted_depts = sorted(dept_totals.items(), key=lambda x: x[1], reverse=True)
            top_dept, top_kwh = sorted_depts[0]
            total_kwh = sum(dept_totals.values())

            return AiChatResponse(
                id=chat_id,
                content=(
                    f"The highest consuming facility is **{top_dept}** with **{top_kwh:,} kWh** "
                    f"({(top_kwh / total_kwh) * 100:.1f}% of total recorded electricity)."
                ),
                timestamp=timestamp,
                calculation_breakdown=CalculationBreakdown(
                    formula="Department Share = (Dept kWh ÷ Total kWh) × 100",
                    inputs={d: f"{k:,.0f} kWh" for d, k in sorted_depts[:4]},
                    result=f"{top_dept} leads with {top_kwh:,.0f} kWh",
                ),
                suggested_follow_ups=[
                    "What actions can reduce my electricity emissions?",
                    "How much can I save by reducing electricity usage by 15%?",
                ],
            )

        # Default actionable recommendations
        return AiChatResponse(
            id=chat_id,
            content=(
                f"Based on your workspace records ({len(records)} periods, latest: {latest['reporting_month']} with {latest['consumption_kwh']:,} kWh), "
                "key priorities include: \n"
                "1. **HVAC temperature set-point calibration**: Adjusting cooling by +1°C saves ~6% energy.\n"
                "2. **Scheduled equipment shutdown**: Implement automated off-hours shutdowns in common areas.\n"
                "3. **Power factor optimization**: Maintain power factor above 0.98 to eliminate utility billing penalties."
            ),
            timestamp=timestamp,
            suggested_follow_ups=[
                "How much can I save by reducing electricity usage by 15%?",
                "Which month had the highest electricity consumption?",
                "Compare this month with the previous month.",
            ],
        )

    @staticmethod
    async def query_transportation_advisor(
        question: str,
        workspace_id: str,
        db: Any,
    ) -> AiChatResponse:
        q = question.lower().strip()
        timestamp = utc_iso()
        chat_id = generate_id("ai_trans")

        # Load bus routes and transportation logs
        routes_cursor = db.bus_routes.find({"workspace_id": workspace_id})
        routes = []
        async for r in routes_cursor:
            routes.append(r)

        trans_cursor = db.transportation_records.find({"workspace_id": workspace_id})
        trans_records = []
        async for t in trans_cursor:
            trans_records.append(t)

        # 1. Combining routes / Route Optimization
        if "combin" in q or "optimiz" in q or "overlap" in q:
            proposals = optimize_bus_routes(routes)
            if proposals:
                p = proposals[0]
                return AiChatResponse(
                    id=chat_id,
                    content=(
                        f"Yes, an optimization candidate was identified: **{p.title}**! \n\n"
                        f"{p.summary}\n"
                        f"• **Potential fuel savings**: ~{p.estimated_fuel_savings_liters} L/month (₹{p.estimated_monthly_savings_inr:,}/month)\n"
                        f"• **Emissions reduction**: ~{p.estimated_emissions_reduction_kg} kg CO2e/month\n"
                        f"• **Feasibility**: {p.feasibility} (Requires morning schedule verification)."
                    ),
                    timestamp=timestamp,
                    calculation_breakdown=CalculationBreakdown(
                        formula="Fuel Reduction = (Current Distance - Combined Distance) ÷ Fleet km/L × Days/Month",
                        inputs={
                            "Current total distance": f"{p.current_config.total_distance_km} km",
                            "Proposed consolidated distance": f"{p.proposed_config.total_distance_km} km",
                            "Distance reduction": f"{p.estimated_distance_reduction_km} km/day",
                        },
                        assumptions=p.assumptions,
                        result=f"Save ~{p.estimated_fuel_savings_liters} L fuel/month (₹{p.estimated_monthly_savings_inr:,})",
                    ),
                    suggested_follow_ups=[
                        "Compare the current routes with the proposed optimized routes.",
                        "Which buses have low occupancy?",
                        "How can I reduce transportation emissions?",
                    ],
                )
            else:
                return AiChatResponse(
                    id=chat_id,
                    content=(
                        f"Evaluated {len(routes)} active routes. No feasible consolidations were found where "
                        "student demand is within single-bus seating capacity and routes share destinations or corridors."
                    ),
                    timestamp=timestamp,
                    suggested_follow_ups=["Which route consumes the most fuel?", "Which buses have low occupancy?"],
                )

        # 2. Low occupancy buses
        if "occupancy" in q or "low" in q:
            low_occupancy = [r for r in routes if r.get("seating_capacity", 40) > 0 and (r.get("assigned_students", 0) / r.get("seating_capacity", 40)) < 0.6]
            if low_occupancy:
                names = ", ".join([f"{r.get('route_name')} ({r.get('assigned_students')}/{r.get('seating_capacity')} seats, {round((r.get('assigned_students')/r.get('seating_capacity'))*100)}%)" for r in low_occupancy])
                return AiChatResponse(
                    id=chat_id,
                    content=f"Identified {len(low_occupancy)} bus route(s) operating below 60% capacity: \n• {names}. These are prime candidates for route consolidation.",
                    timestamp=timestamp,
                    suggested_follow_ups=["Can any of my routes be combined?", "Which route consumes the most fuel?"],
                )
            return AiChatResponse(
                id=chat_id,
                content="All currently registered bus routes have healthy passenger utilization (>= 60% capacity).",
                timestamp=timestamp,
            )

        # 3. Highest fuel consumption
        if "fuel" in q and ("most" in q or "highest" in q or "peak" in q):
            if routes:
                peak_route = max(routes, key=lambda x: (x.get("distance_km", 0) * x.get("trips_per_day", 2)) / max(1.0, x.get("fuel_efficiency_km_per_l", 4.5)))
                daily_fuel = round((peak_route.get("distance_km", 0) * peak_route.get("trips_per_day", 2)) / max(1.0, peak_route.get("fuel_efficiency_km_per_l", 4.5)), 1)
                return AiChatResponse(
                    id=chat_id,
                    content=f"**{peak_route.get('route_name')}** consumes the most fuel at an estimated **{daily_fuel} L/day** ({peak_route.get('distance_km')} km/run, {peak_route.get('trips_per_day')} trips/day, {peak_route.get('fuel_efficiency_km_per_l')} km/L).",
                    timestamp=timestamp,
                    calculation_breakdown=CalculationBreakdown(
                        formula="Daily Fuel = (Distance × Trips) ÷ Fuel Efficiency",
                        inputs={
                            "Route": peak_route.get("route_name", ""),
                            "Distance": f"{peak_route.get('distance_km')} km",
                            "Fuel Efficiency": f"{peak_route.get('fuel_efficiency_km_per_l')} km/L",
                        },
                        result=f"{daily_fuel} L/day",
                    ),
                    suggested_follow_ups=["Can any of my routes be combined?", "How can I reduce transportation emissions?"],
                )

        # 4. Default transportation recommendation
        total_dist = sum(r.get("distance_km", 0) for r in trans_records)
        return AiChatResponse(
            id=chat_id,
            content=(
                f"Across your {len(routes)} bus routes and {len(trans_records)} fleet activity records ({total_dist:,.0f} km logged), "
                "effective mitigation opportunities include:\n"
                "1. **Consolidate overlapping morning corridors**: Merge low-occupancy routes sharing intermediate stops.\n"
                "2. **Enforce preventive tire pressure audits**: Proper inflation improves heavy fleet fuel efficiency by 3-5%.\n"
                "3. **Transition feeder routes to electric vans**: Reduces Scope 1 tailpipe emissions to zero."
            ),
            timestamp=timestamp,
            suggested_follow_ups=[
                "Can any of my routes be combined?",
                "Which route consumes the most fuel?",
                "Which buses have low occupancy?",
            ],
        )

    @staticmethod
    async def query_waste_advisor(
        question: str,
        workspace_id: str,
        db: Any,
    ) -> AiChatResponse:
        q = question.lower().strip()
        timestamp = utc_iso()
        chat_id = generate_id("ai_waste")

        cursor = db.waste_records.find({"workspace_id": workspace_id})
        records = []
        async for r in cursor:
            records.append(r)

        if not records:
            return AiChatResponse(
                id=chat_id,
                content="No waste records have been logged in this workspace yet. Add a record to unlock waste diversion metrics.",
                timestamp=timestamp,
            )

        total_kg = sum(r.get("quantity_kg", 0.0) for r in records)
        recycled_kg = sum(
            r.get("quantity_kg", 0.0)
            for r in records
            if (r.get("treatment_method") or "").lower() == "recycling" or (r.get("category") or "").lower() == "recyclable"
        )
        rate = calculate_recycling_rate(recycled_kg, total_kg)

        # 1. Recycling rate improvement
        if "recycl" in q:
            return AiChatResponse(
                id=chat_id,
                content=(
                    f"Your current recorded recycling recovery rate is **{rate or 0:.1f}%** ({recycled_kg:,.0f} kg recycled out of {total_kg:,.0f} kg total). "
                    "To reach an 80%+ diversion rate:\n"
                    "• Introduce 3-bin color-coded segregation at every major department station.\n"
                    "• Partner with certified recyclers for bulk cardboard and e-waste take-back credits."
                ),
                timestamp=timestamp,
                calculation_breakdown=CalculationBreakdown(
                    formula="Recycling Rate = (Recycled kg ÷ Total kg) × 100",
                    inputs={
                        "Recycled waste": f"{recycled_kg:,.0f} kg",
                        "Total waste generated": f"{total_kg:,.0f} kg",
                    },
                    result=f"{rate or 0:.1f}% recovery rate",
                ),
                suggested_follow_ups=[
                    "Which waste category contributes the most to our total waste?",
                    "What practical steps could reduce organic waste?",
                    "How can we improve waste segregation?",
                ],
            )

        # 2. Category contribution
        if "category" in q or "contribute" in q or "most" in q:
            cat_totals: Dict[str, float] = {}
            for r in records:
                c = r.get("category") or "General"
                cat_totals[c] = cat_totals.get(c, 0.0) + r.get("quantity_kg", 0.0)
            top_cat, top_qty = max(cat_totals.items(), key=lambda x: x[1])
            return AiChatResponse(
                id=chat_id,
                content=(
                    f"**{top_cat}** is your largest waste stream, representing **{top_qty:,.0f} kg** "
                    f"({(top_qty / total_kg) * 100:.1f}% of all logged waste across {len(records)} entries)."
                ),
                timestamp=timestamp,
                calculation_breakdown=CalculationBreakdown(
                    formula="Category % = (Category kg ÷ Total kg) × 100",
                    inputs={c: f"{k:,.0f} kg" for c, k in cat_totals.items()},
                    result=f"{top_cat} ({top_qty:,.0f} kg)",
                ),
                suggested_follow_ups=[
                    "How can we improve our recycling rate?",
                    "What practical steps could reduce organic waste?",
                ],
            )

        # Default recommendations
        return AiChatResponse(
            id=chat_id,
            content=(
                f"From {total_kg:,.0f} kg of recorded waste across {len(records)} entries:\n"
                "1. **Segregation at source**: Contamination degrades recyclable value; enforce clear bin labeling.\n"
                "2. **On-campus organic composting**: Divert cafeteria wet waste from landfills to avoid methane emissions.\n"
                "3. **E-waste compliance**: Partner with authorized dismantlers to ensure safe recovery of precious metals."
            ),
            timestamp=timestamp,
            suggested_follow_ups=[
                "Which waste category contributes the most to our total waste?",
                "How can we improve our recycling rate?",
                "What practical steps could reduce organic waste?",
            ],
        )
