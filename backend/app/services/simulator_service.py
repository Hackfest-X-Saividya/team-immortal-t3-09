from typing import Any
from app.calculations.savings_calculator import (
    SimulatorProjectionResult,
    simulate_electricity_savings,
    simulate_transportation_savings,
    simulate_waste_savings,
)
from app.schemas.simulator import ElectricitySimRequest, TransportSimRequest, WasteSimRequest
from app.services.electricity_service import get_electricity_summary
from app.services.transportation_service import get_transportation_summary
from app.services.waste_service import get_waste_summary


async def run_electricity_simulation(
    req: ElectricitySimRequest,
    workspace_id: str,
    db: Any,
) -> SimulatorProjectionResult:
    summary = await get_electricity_summary(workspace_id, db)
    baseline_kwh = summary.total_consumption_kwh if summary.total_consumption_kwh > 0 else 1240.0
    return simulate_electricity_savings(
        baseline_kwh=baseline_kwh,
        percent_reduction=req.percent_reduction,
        tariff_inr=req.custom_tariff_inr,
    )


async def run_transportation_simulation(
    req: TransportSimRequest,
    workspace_id: str,
    db: Any,
) -> SimulatorProjectionResult:
    summary = await get_transportation_summary(workspace_id, db)
    baseline_km = summary.total_distance_km if summary.total_distance_km > 0 else 850.0
    return simulate_transportation_savings(
        baseline_distance_km=baseline_km,
        percent_distance_reduction=req.percent_distance_reduction,
        fuel_efficiency_km_per_l=req.fuel_efficiency_km_per_l or 4.5,
        fuel_type=req.fuel_type or "Diesel",
    )


async def run_waste_simulation(
    req: WasteSimRequest,
    workspace_id: str,
    db: Any,
) -> SimulatorProjectionResult:
    summary = await get_waste_summary(workspace_id, db)
    baseline_kg = summary.total_waste_kg if summary.total_waste_kg > 0 else 420.0
    return simulate_waste_savings(
        baseline_quantity_kg=baseline_kg,
        percent_reduction=req.percent_reduction,
        target_recycling_percent=req.target_recycling_percent or 60.0,
    )
