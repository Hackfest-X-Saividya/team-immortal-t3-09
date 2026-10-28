from collections import defaultdict
from typing import Any, Dict, List, Optional
from app.calculations.transportation_calculator import calculate_transportation_emissions
from app.core.exceptions import EntityNotFoundException
from app.schemas.transportation import (
    TransportationCreateRequest,
    TransportationRecordResponse,
    TransportationSummaryResponse,
    TransportationUpdateRequest,
)
from app.utils.dates import normalize_month, utc_iso
from app.utils.ids import generate_id


async def create_transportation_record(
    req: TransportationCreateRequest,
    workspace_id: str,
    user_id: str,
    db: Any,
) -> TransportationRecordResponse:
    calc = calculate_transportation_emissions(
        distance_km=req.distance_km,
        fuel_type=req.fuel_type or "Diesel",
        fuel_consumed_liters=req.fuel_consumed_liters,
        fuel_efficiency_km_per_l=req.fuel_efficiency_km_per_l,
    )
    now = utc_iso()
    record_id = generate_id("trans")

    doc = {
        "id": record_id,
        "workspace_id": workspace_id,
        "creator_id": user_id,
        "date": req.date,
        "mode": req.mode,
        "distance_km": req.distance_km,
        "fuel_type": req.fuel_type or "Diesel",
        "fuel_consumed_liters": req.fuel_consumed_liters,
        "fuel_efficiency_km_per_l": req.fuel_efficiency_km_per_l,
        "fuel_expenditure_inr": req.fuel_expenditure_inr,
        "vehicle_id": req.vehicle_id,
        "passenger_count": req.passenger_count,
        "notes": req.notes,
        "calculation_method": calc.calculation_method,
        "calculated_emissions_kg": calc.calculated_emissions_kg,
        "created_at": now,
        "updated_at": now,
    }
    await db.transportation_records.insert_one(doc)
    return TransportationRecordResponse(**doc)


async def list_transportation_records(
    workspace_id: str,
    db: Any,
    skip: int = 0,
    limit: int = 100,
) -> List[TransportationRecordResponse]:
    cursor = db.transportation_records.find({"workspace_id": workspace_id}).sort("date", -1).skip(skip).limit(limit)
    records = []
    async for item in cursor:
        item.pop("_id", None)
        records.append(TransportationRecordResponse(**item))
    return records


async def get_transportation_record(
    record_id: str,
    workspace_id: str,
    db: Any,
) -> TransportationRecordResponse:
    doc = await db.transportation_records.find_one({"id": record_id, "workspace_id": workspace_id})
    if not doc:
        raise EntityNotFoundException(f"Transportation record {record_id} not found.")
    doc.pop("_id", None)
    return TransportationRecordResponse(**doc)


async def update_transportation_record(
    record_id: str,
    req: TransportationUpdateRequest,
    workspace_id: str,
    db: Any,
) -> TransportationRecordResponse:
    doc = await db.transportation_records.find_one({"id": record_id, "workspace_id": workspace_id})
    if not doc:
        raise EntityNotFoundException(f"Transportation record {record_id} not found.")

    updates: Dict[str, Any] = {"updated_at": utc_iso()}

    new_dist = req.distance_km if req.distance_km is not None else doc["distance_km"]
    new_fuel_type = req.fuel_type if req.fuel_type is not None else doc.get("fuel_type", "Diesel")
    new_fuel_consumed = req.fuel_consumed_liters if req.fuel_consumed_liters is not None else doc.get("fuel_consumed_liters")
    new_efficiency = req.fuel_efficiency_km_per_l if req.fuel_efficiency_km_per_l is not None else doc.get("fuel_efficiency_km_per_l")

    calc = calculate_transportation_emissions(
        distance_km=new_dist,
        fuel_type=new_fuel_type,
        fuel_consumed_liters=new_fuel_consumed,
        fuel_efficiency_km_per_l=new_efficiency,
    )
    updates["distance_km"] = new_dist
    updates["fuel_type"] = new_fuel_type
    updates["fuel_consumed_liters"] = new_fuel_consumed
    updates["fuel_efficiency_km_per_l"] = new_efficiency
    updates["calculated_emissions_kg"] = calc.calculated_emissions_kg
    updates["calculation_method"] = calc.calculation_method

    if req.date is not None:
        updates["date"] = req.date
    if req.mode is not None:
        updates["mode"] = req.mode
    if req.fuel_expenditure_inr is not None:
        updates["fuel_expenditure_inr"] = req.fuel_expenditure_inr
    if req.vehicle_id is not None:
        updates["vehicle_id"] = req.vehicle_id
    if req.passenger_count is not None:
        updates["passenger_count"] = req.passenger_count
    if req.notes is not None:
        updates["notes"] = req.notes

    await db.transportation_records.update_one({"id": record_id, "workspace_id": workspace_id}, {"$set": updates})
    updated_doc = await db.transportation_records.find_one({"id": record_id, "workspace_id": workspace_id})
    updated_doc.pop("_id", None)
    return TransportationRecordResponse(**updated_doc)


async def delete_transportation_record(
    record_id: str,
    workspace_id: str,
    db: Any,
) -> bool:
    res = await db.transportation_records.delete_one({"id": record_id, "workspace_id": workspace_id})
    if res.deleted_count == 0:
        raise EntityNotFoundException(f"Transportation record {record_id} not found.")
    return True


async def get_transportation_summary(
    workspace_id: str,
    db: Any,
) -> TransportationSummaryResponse:
    cursor = db.transportation_records.find({"workspace_id": workspace_id}).sort("date", 1)
    records = []
    async for item in cursor:
        item.pop("_id", None)
        records.append(item)

    if not records:
        return TransportationSummaryResponse(
            total_distance_km=0.0,
            total_fuel_liters=0.0,
            total_expenditure_inr=0.0,
            total_calculated_emissions_kg=0.0,
            record_count=0,
            mode_breakdown=[],
            monthly_trends=[],
        )

    total_dist = sum(r.get("distance_km", 0.0) for r in records)
    total_fuel = sum(r.get("fuel_consumed_liters", 0.0) or 0.0 for r in records)
    total_exp = sum(r.get("fuel_expenditure_inr", 0.0) or 0.0 for r in records)
    total_emissions = sum(r.get("calculated_emissions_kg", 0.0) for r in records)

    mode_map = defaultdict(lambda: {"distance_km": 0.0, "emissions_kg": 0.0, "count": 0})
    monthly_map = defaultdict(lambda: {"distance_km": 0.0, "emissions_kg": 0.0, "fuel_expenditure_inr": 0.0})

    for r in records:
        m = r.get("mode") or "Unspecified"
        mode_map[m]["distance_km"] += r.get("distance_km", 0.0)
        mode_map[m]["emissions_kg"] += r.get("calculated_emissions_kg", 0.0)
        mode_map[m]["count"] += 1

        month_str = normalize_month(r.get("date", ""))
        monthly_map[month_str]["distance_km"] += r.get("distance_km", 0.0)
        monthly_map[month_str]["emissions_kg"] += r.get("calculated_emissions_kg", 0.0)
        monthly_map[month_str]["fuel_expenditure_inr"] += r.get("fuel_expenditure_inr", 0.0) or 0.0

    mode_breakdown = [
        {
            "mode": mode,
            "distance_km": round(data["distance_km"], 1),
            "emissions_kg": round(data["emissions_kg"], 1),
            "percentage": round((data["distance_km"] / total_dist) * 100, 1) if total_dist > 0 else 0,
        }
        for mode, data in mode_map.items()
    ]

    monthly_trends = [
        {
            "month": m,
            "distance_km": round(data["distance_km"], 1),
            "emissions_kg": round(data["emissions_kg"], 1),
            "fuel_expenditure_inr": round(data["fuel_expenditure_inr"], 0),
        }
        for m, data in sorted(monthly_map.items())
    ]

    return TransportationSummaryResponse(
        total_distance_km=round(total_dist, 1),
        total_fuel_liters=round(total_fuel, 1),
        total_expenditure_inr=round(total_exp, 0),
        total_calculated_emissions_kg=round(total_emissions, 1),
        record_count=len(records),
        mode_breakdown=mode_breakdown,
        monthly_trends=monthly_trends,
    )
