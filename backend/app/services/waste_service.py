from collections import defaultdict
from typing import Any, Dict, List, Optional
from app.calculations.waste_calculator import calculate_recycling_rate, calculate_waste_emissions
from app.core.exceptions import EntityNotFoundException
from app.schemas.waste import (
    WasteCreateRequest,
    WasteRecordResponse,
    WasteSummaryResponse,
    WasteUpdateRequest,
)
from app.utils.dates import normalize_month, utc_iso
from app.utils.ids import generate_id


async def create_waste_record(
    req: WasteCreateRequest,
    workspace_id: str,
    user_id: str,
    db: Any,
) -> WasteRecordResponse:
    calc = calculate_waste_emissions(
        quantity_kg=req.quantity_kg,
        treatment_method=req.treatment_method,
        category=req.category,
    )
    now = utc_iso()
    record_id = generate_id("waste")

    doc = {
        "id": record_id,
        "workspace_id": workspace_id,
        "creator_id": user_id,
        "date": req.date,
        "category": req.category,
        "quantity_kg": req.quantity_kg,
        "treatment_method": req.treatment_method or "Other / Unknown",
        "building_or_department": req.building_or_department,
        "collection_provider": req.collection_provider,
        "disposal_cost_inr": req.disposal_cost_inr,
        "notes": req.notes,
        "calculated_emissions_kg": calc.calculated_emissions_kg,
        "emission_factor_used": calc.emission_factor_used,
        "status": "Verified",
        "created_at": now,
        "updated_at": now,
    }
    await db.waste_records.insert_one(doc)
    return WasteRecordResponse(**doc)


async def list_waste_records(
    workspace_id: str,
    db: Any,
    skip: int = 0,
    limit: int = 100,
) -> List[WasteRecordResponse]:
    cursor = db.waste_records.find({"workspace_id": workspace_id}).sort("date", -1).skip(skip).limit(limit)
    records = []
    async for item in cursor:
        item.pop("_id", None)
        records.append(WasteRecordResponse(**item))
    return records


async def get_waste_record(
    record_id: str,
    workspace_id: str,
    db: Any,
) -> WasteRecordResponse:
    doc = await db.waste_records.find_one({"id": record_id, "workspace_id": workspace_id})
    if not doc:
        raise EntityNotFoundException(f"Waste record {record_id} not found.")
    doc.pop("_id", None)
    return WasteRecordResponse(**doc)


async def update_waste_record(
    record_id: str,
    req: WasteUpdateRequest,
    workspace_id: str,
    db: Any,
) -> WasteRecordResponse:
    doc = await db.waste_records.find_one({"id": record_id, "workspace_id": workspace_id})
    if not doc:
        raise EntityNotFoundException(f"Waste record {record_id} not found.")

    updates: Dict[str, Any] = {"updated_at": utc_iso()}
    new_qty = req.quantity_kg if req.quantity_kg is not None else doc["quantity_kg"]
    new_method = req.treatment_method if req.treatment_method is not None else doc.get("treatment_method")
    new_cat = req.category if req.category is not None else doc.get("category")

    calc = calculate_waste_emissions(quantity_kg=new_qty, treatment_method=new_method, category=new_cat)
    updates["quantity_kg"] = new_qty
    updates["treatment_method"] = new_method
    updates["category"] = new_cat
    updates["calculated_emissions_kg"] = calc.calculated_emissions_kg
    updates["emission_factor_used"] = calc.emission_factor_used

    if req.date is not None:
        updates["date"] = req.date
    if req.building_or_department is not None:
        updates["building_or_department"] = req.building_or_department
    if req.collection_provider is not None:
        updates["collection_provider"] = req.collection_provider
    if req.disposal_cost_inr is not None:
        updates["disposal_cost_inr"] = req.disposal_cost_inr
    if req.notes is not None:
        updates["notes"] = req.notes

    await db.waste_records.update_one({"id": record_id, "workspace_id": workspace_id}, {"$set": updates})
    updated_doc = await db.waste_records.find_one({"id": record_id, "workspace_id": workspace_id})
    updated_doc.pop("_id", None)
    return WasteRecordResponse(**updated_doc)


async def delete_waste_record(
    record_id: str,
    workspace_id: str,
    db: Any,
) -> bool:
    res = await db.waste_records.delete_one({"id": record_id, "workspace_id": workspace_id})
    if res.deleted_count == 0:
        raise EntityNotFoundException(f"Waste record {record_id} not found.")
    return True


async def get_waste_summary(
    workspace_id: str,
    db: Any,
) -> WasteSummaryResponse:
    cursor = db.waste_records.find({"workspace_id": workspace_id}).sort("date", 1)
    records = []
    async for item in cursor:
        item.pop("_id", None)
        records.append(item)

    if not records:
        return WasteSummaryResponse(
            total_waste_kg=0.0,
            recycled_waste_kg=0.0,
            recycling_rate_percent=None,
            total_calculated_emissions_kg=0.0,
            record_count=0,
            category_breakdown=[],
            treatment_breakdown=[],
            monthly_trends=[],
        )

    total_qty = sum(r.get("quantity_kg", 0.0) for r in records)
    total_emissions = sum(r.get("calculated_emissions_kg", 0.0) for r in records)

    cat_map = defaultdict(float)
    treatment_map = defaultdict(float)
    monthly_map = defaultdict(lambda: {"quantity_kg": 0.0, "emissions_kg": 0.0})

    recycled_qty = 0.0
    for r in records:
        qty = r.get("quantity_kg", 0.0)
        cat = r.get("category") or "Unspecified"
        method = r.get("treatment_method") or "Other / Unknown"
        cat_map[cat] += qty
        treatment_map[method] += qty

        if method.strip().lower() == "recycling" or cat.strip().lower() == "recyclable":
            recycled_qty += qty

        month_str = normalize_month(r.get("date", ""))
        monthly_map[month_str]["quantity_kg"] += qty
        monthly_map[month_str]["emissions_kg"] += r.get("calculated_emissions_kg", 0.0)

    recycling_rate = calculate_recycling_rate(recycled_qty, total_qty)

    cat_breakdown = [
        {"category": cat, "quantity_kg": round(qty, 1), "percentage": round((qty / total_qty) * 100, 1) if total_qty > 0 else 0}
        for cat, qty in cat_map.items()
    ]

    treatment_breakdown = [
        {"treatment_method": method, "quantity_kg": round(qty, 1), "percentage": round((qty / total_qty) * 100, 1) if total_qty > 0 else 0}
        for method, qty in treatment_map.items()
    ]

    monthly_trends = [
        {
            "month": m,
            "quantity_kg": round(data["quantity_kg"], 1),
            "emissions_kg": round(data["emissions_kg"], 1),
        }
        for m, data in sorted(monthly_map.items())
    ]

    return WasteSummaryResponse(
        total_waste_kg=round(total_qty, 1),
        recycled_waste_kg=round(recycled_qty, 1),
        recycling_rate_percent=recycling_rate,
        total_calculated_emissions_kg=round(total_emissions, 1),
        record_count=len(records),
        category_breakdown=cat_breakdown,
        treatment_breakdown=treatment_breakdown,
        monthly_trends=monthly_trends,
    )
