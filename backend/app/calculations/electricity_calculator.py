from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.data.emission_factors import EMISSION_FACTORS, BENCHMARK_PRICES


class ElectricityEmissionsResult(BaseModel):
    consumption_kwh: float
    calculated_emissions_kg: float
    emission_factor_used: float
    factor_id: str
    factor_type: str  # "illustrative_grid_factor" | "measured"
    unit: str = "kg CO2e"
    calculation_method: str = "consumption_kwh * grid_emission_factor"
    is_valid: bool = True
    notes: Optional[str] = None


class ElectricitySavingsScenario(BaseModel):
    current_kwh: float
    percent_reduction: float
    kwh_reduction: float
    cost_savings_inr: float
    emissions_reduction_kg: float
    tariff_inr_per_kwh: float
    assumptions: List[str]


def calculate_electricity_emissions(
    consumption_kwh: float,
    factor_id: str = "grid_in_cea_baseline"
) -> ElectricityEmissionsResult:
    """
    Calculates electricity emissions based on consumption in kWh.
    Formula: Electricity emissions (kg CO2e) = consumption (kWh) × emission factor (kg CO2e/kWh)
    """
    factor = EMISSION_FACTORS.get(factor_id)
    if not factor:
        # Fallback to standard baseline factor if custom ID unknown
        factor = EMISSION_FACTORS["grid_in_cea_baseline"]

    if consumption_kwh is None or consumption_kwh < 0:
        return ElectricityEmissionsResult(
            consumption_kwh=0.0,
            calculated_emissions_kg=0.0,
            emission_factor_used=factor.value,
            factor_id=factor.factor_id,
            factor_type="illustrative_grid_factor" if not factor.is_authoritative else "measured",
            is_valid=False,
            notes="Invalid consumption value. Must be a non-negative number.",
        )

    emissions = round(consumption_kwh * factor.value, 2)
    return ElectricityEmissionsResult(
        consumption_kwh=consumption_kwh,
        calculated_emissions_kg=emissions,
        emission_factor_used=factor.value,
        factor_id=factor.factor_id,
        factor_type="illustrative_grid_factor" if not factor.is_authoritative else "measured",
        is_valid=True,
        notes=f"Calculated with {factor.source} ({factor.value} {factor.unit}).",
    )


def calculate_electricity_savings_scenario(
    current_kwh: float,
    percent_reduction: float,
    tariff_inr: Optional[float] = None,
    factor_id: str = "grid_in_cea_baseline"
) -> ElectricitySavingsScenario:
    """
    Calculates what-if financial and carbon savings for an electricity reduction scenario.
    """
    tariff = tariff_inr if tariff_inr is not None and tariff_inr > 0 else BENCHMARK_PRICES["electricity_tariff_inr_per_kwh"]
    factor = EMISSION_FACTORS.get(factor_id, EMISSION_FACTORS["grid_in_cea_baseline"])

    safe_kwh = max(0.0, current_kwh)
    safe_percent = max(0.0, min(100.0, percent_reduction))

    kwh_reduction = round((safe_kwh * safe_percent) / 100.0, 1)
    cost_savings = round(kwh_reduction * tariff, 0)
    emissions_reduction = round(kwh_reduction * factor.value, 1)

    return ElectricitySavingsScenario(
        current_kwh=safe_kwh,
        percent_reduction=safe_percent,
        kwh_reduction=kwh_reduction,
        cost_savings_inr=cost_savings,
        emissions_reduction_kg=emissions_reduction,
        tariff_inr_per_kwh=tariff,
        assumptions=[
            f"Illustrative grid emission factor: {factor.value} kg CO2e/kWh ({factor.source}).",
            f"Estimated variable electricity tariff: INR {tariff}/kWh (excluding fixed meter and demand charges).",
        ],
    )
