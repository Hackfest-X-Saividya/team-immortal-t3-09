from collections import defaultdict
from typing import Any, Dict, List, Optional
from app.calculations.electricity_calculator import calculate_electricity_emissions
from app.core.exceptions import EntityNotFoundException
from app.schemas.electricity import (
    ElectricityCreateRequest,
    ElectricityRecordResponse,
    ElectricitySummaryResponse,
    ElectricityUpdateRequest,
    MonthlyElectricityTrend,
)
from app.utils.dates import utc_iso
from app.utils.ids import generate_id


async def create_electricity_record(
    req: ElectricityCreateRequest,
    workspace_id: str,
    user_id: str,
    db: Any,
) -> ElectricityRecordResponse:
    calc = calculate_electricity_emissions(req.consumption_kwh)
    now = utc_iso()
    record_id = generate_id("elec")

    doc = {
        "id": record_id,
        "workspace_id": workspace_id,
        "creator_id": user_id,
        "reporting_month": req.reporting_month,
        "consumption_kwh": req.consumption_kwh,
        "bill_amount_inr": req.bill_amount_inr,
        "building_or_department": req.building_or_department,
        "notes": req.notes,
        "calculated_emissions_kg": calc.calculated_emissions_kg,
        "emission_factor_used": calc.emission_factor_used,
        "factor_type": calc.factor_type,
        "created_at": now,
        "updated_at": now,
    }
    await db.electricity_records.insert_one(doc)
    return ElectricityRecordResponse(**doc)


async def list_electricity_records(
    workspace_id: str,
    db: Any,
    month: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[ElectricityRecordResponse]:
    query: Dict[str, Any] = {"workspace_id": workspace_id}
    if month:
        query["reporting_month"] = month

    cursor = db.electricity_records.find(query).sort("reporting_month", -1).skip(skip).limit(limit)
    records = []
    async for item in cursor:
        item.pop("_id", None)
        records.append(ElectricityRecordResponse(**item))
    return records


async def get_electricity_record(
    record_id: str,
    workspace_id: str,
    db: Any,
) -> ElectricityRecordResponse:
    doc = await db.electricity_records.find_one({"id": record_id, "workspace_id": workspace_id})
    if not doc:
        raise EntityNotFoundException(f"Electricity record {record_id} not found.")
    doc.pop("_id", None)
    return ElectricityRecordResponse(**doc)


async def update_electricity_record(
    record_id: str,
    req: ElectricityUpdateRequest,
    workspace_id: str,
    db: Any,
) -> ElectricityRecordResponse:
    doc = await db.electricity_records.find_one({"id": record_id, "workspace_id": workspace_id})
    if not doc:
        raise EntityNotFoundException(f"Electricity record {record_id} not found.")

    updates: Dict[str, Any] = {"updated_at": utc_iso()}
    new_consumption = req.consumption_kwh if req.consumption_kwh is not None else doc["consumption_kwh"]

    if req.consumption_kwh is not None:
        calc = calculate_electricity_emissions(new_consumption)
        updates["consumption_kwh"] = new_consumption
        updates["calculated_emissions_kg"] = calc.calculated_emissions_kg
        updates["emission_factor_used"] = calc.emission_factor_used
        updates["factor_type"] = calc.factor_type

    if req.reporting_month is not None:
        updates["reporting_month"] = req.reporting_month
    if req.bill_amount_inr is not None:
        updates["bill_amount_inr"] = req.bill_amount_inr
    if req.building_or_department is not None:
        updates["building_or_department"] = req.building_or_department
    if req.notes is not None:
        updates["notes"] = req.notes

    await db.electricity_records.update_one({"id": record_id, "workspace_id": workspace_id}, {"$set": updates})
    updated_doc = await db.electricity_records.find_one({"id": record_id, "workspace_id": workspace_id})
    updated_doc.pop("_id", None)
    return ElectricityRecordResponse(**updated_doc)


async def delete_electricity_record(
    record_id: str,
    workspace_id: str,
    db: Any,
) -> bool:
    res = await db.electricity_records.delete_one({"id": record_id, "workspace_id": workspace_id})
    if res.deleted_count == 0:
        raise EntityNotFoundException(f"Electricity record {record_id} not found.")
    return True


async def get_electricity_summary(
    workspace_id: str,
    db: Any,
) -> ElectricitySummaryResponse:
    cursor = db.electricity_records.find({"workspace_id": workspace_id}).sort("reporting_month", 1)
    records = []
    async for item in cursor:
        item.pop("_id", None)
        records.append(item)

    if not records:
        return ElectricitySummaryResponse(
            total_consumption_kwh=0.0,
            total_bill_inr=0.0,
            total_calculated_emissions_kg=0.0,
            record_count=0,
            monthly_trends=[],
            department_breakdown=[],
            previous_period_comparison=None,
        )

    total_kwh = sum(r.get("consumption_kwh", 0.0) for r in records)
    total_bill = sum(r.get("bill_amount_inr", 0.0) or 0.0 for r in records)
    total_emissions = sum(r.get("calculated_emissions_kg", 0.0) for r in records)

    monthly_map = defaultdict(lambda: {"consumption_kwh": 0.0, "bill_amount_inr": 0.0, "calculated_emissions_kg": 0.0})
    dept_map = defaultdict(float)

    for r in records:
        m = r.get("reporting_month", "")
        monthly_map[m]["consumption_kwh"] += r.get("consumption_kwh", 0.0)
        monthly_map[m]["bill_amount_inr"] += r.get("bill_amount_inr", 0.0) or 0.0
        monthly_map[m]["calculated_emissions_kg"] += r.get("calculated_emissions_kg", 0.0)
        dept = r.get("building_or_department") or "Unassigned"
        dept_map[dept] += r.get("consumption_kwh", 0.0)

    sorted_months = sorted(monthly_map.keys())
    trends = [
        MonthlyElectricityTrend(
            reporting_month=m,
            consumption_kwh=round(monthly_map[m]["consumption_kwh"], 1),
            bill_amount_inr=round(monthly_map[m]["bill_amount_inr"], 0),
            calculated_emissions_kg=round(monthly_map[m]["calculated_emissions_kg"], 1),
        )
        for m in sorted_months
    ]

    dept_breakdown = [
        {"department": dept, "consumption_kwh": round(kwh, 1), "percentage": round((kwh / total_kwh) * 100, 1)}
        for dept, kwh in dept_map.items()
    ]

    # Month over month comparison if at least 2 periods
    prev_comparison = None
    if len(trends) >= 2:
        latest = trends[-1]
        prev = trends[-2]
        kwh_diff = round(latest.consumption_kwh - prev.consumption_kwh, 1)
        pct_diff = round((kwh_diff / prev.consumption_kwh) * 100, 1) if prev.consumption_kwh > 0 else 0.0
        prev_comparison = {
            "latest_month": latest.reporting_month,
            "previous_month": prev.reporting_month,
            "consumption_difference_kwh": kwh_diff,
            "percentage_change": pct_diff,
            "trend": "increased" if kwh_diff > 0 else "decreased" if kwh_diff < 0 else "unchanged",
        }

    return ElectricitySummaryResponse(
        total_consumption_kwh=round(total_kwh, 1),
        total_bill_inr=round(total_bill, 0),
        total_calculated_emissions_kg=round(total_emissions, 1),
        record_count=len(records),
        monthly_trends=trends,
        department_breakdown=dept_breakdown,
        previous_period_comparison=prev_comparison,
    )
