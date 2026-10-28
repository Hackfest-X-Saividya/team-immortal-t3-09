from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class EmissionFactor:
    factor_id: str
    activity_type: str  # "electricity" | "transportation" | "waste"
    sub_category: Optional[str]  # e.g., "Diesel", "Recycling"
    value: float
    unit: str  # "kg CO2e / kWh", "kg CO2e / L", "kg CO2e / kg"
    geography: str
    reporting_period: str
    source: str
    version: str
    is_authoritative: bool
    notes: str


# ==============================================================================
# Central Emission Factor Catalog
# ==============================================================================

EMISSION_FACTORS: Dict[str, EmissionFactor] = {
    # Electricity Grid Factor
    "grid_in_cea_baseline": EmissionFactor(
        factor_id="grid_in_cea_baseline",
        activity_type="electricity",
        sub_category="Grid Electricity",
        value=0.82,
        unit="kg CO2e / kWh",
        geography="India",
        reporting_period="2023-2024",
        source="CEA CO2 Baseline Database v19 (Illustrative Average)",
        version="1.0.0",
        is_authoritative=False,
        notes="Illustrative national grid emission factor representing combined margin baseline.",
    ),

    # Transportation Fuels
    "fuel_diesel_standard": EmissionFactor(
        factor_id="fuel_diesel_standard",
        activity_type="transportation",
        sub_category="Diesel",
        value=2.68,
        unit="kg CO2e / L",
        geography="Global / Standard",
        reporting_period="2024",
        source="DEFRA / IPCC Guidelines (Illustrative)",
        version="1.0.0",
        is_authoritative=False,
        notes="Scope 1 direct tailpipe combustion factor per litre of automotive diesel.",
    ),
    "fuel_petrol_standard": EmissionFactor(
        factor_id="fuel_petrol_standard",
        activity_type="transportation",
        sub_category="Petrol",
        value=2.31,
        unit="kg CO2e / L",
        geography="Global / Standard",
        reporting_period="2024",
        source="DEFRA / IPCC Guidelines (Illustrative)",
        version="1.0.0",
        is_authoritative=False,
        notes="Scope 1 direct tailpipe combustion factor per litre of motor gasoline.",
    ),
    "fuel_cng_standard": EmissionFactor(
        factor_id="fuel_cng_standard",
        activity_type="transportation",
        sub_category="CNG",
        value=2.75,
        unit="kg CO2e / kg",
        geography="Global / Standard",
        reporting_period="2024",
        source="DEFRA Guidelines (Illustrative)",
        version="1.0.0",
        is_authoritative=False,
        notes="Compressed natural gas combustion factor per kg.",
    ),
    "fuel_electric_standard": EmissionFactor(
        factor_id="fuel_electric_standard",
        activity_type="transportation",
        sub_category="Electric",
        value=0.82,
        unit="kg CO2e / kWh",
        geography="India",
        reporting_period="2024",
        source="CEA Grid Equivalent",
        version="1.0.0",
        is_authoritative=False,
        notes="Scope 2 indirect factor based on average grid electricity mix.",
    ),

    # Waste Treatment Methods
    "waste_composting": EmissionFactor(
        factor_id="waste_composting",
        activity_type="waste",
        sub_category="Composting",
        value=0.10,
        unit="kg CO2e / kg",
        geography="Global / Standard",
        reporting_period="2024",
        source="IPCC Waste Model (Illustrative)",
        version="1.0.0",
        is_authoritative=False,
        notes="Aerobic decomposition emission factor for segregated organic waste.",
    ),
    "waste_recycling": EmissionFactor(
        factor_id="waste_recycling",
        activity_type="waste",
        sub_category="Recycling",
        value=-0.45,
        unit="kg CO2e / kg",
        geography="Global / Standard",
        reporting_period="2024",
        source="EPA WARM Model (Illustrative)",
        version="1.0.0",
        is_authoritative=False,
        notes="Avoided virgin material production credit (net carbon reduction).",
    ),
    "waste_landfill": EmissionFactor(
        factor_id="waste_landfill",
        activity_type="waste",
        sub_category="Landfill",
        value=1.25,
        unit="kg CO2e / kg",
        geography="Global / Standard",
        reporting_period="2024",
        source="IPCC Waste Model (Illustrative)",
        version="1.0.0",
        is_authoritative=False,
        notes="Anaerobic methane generation factor without active gas capture.",
    ),
    "waste_other": EmissionFactor(
        factor_id="waste_other",
        activity_type="waste",
        sub_category="Other / Unknown",
        value=0.50,
        unit="kg CO2e / kg",
        geography="Global / Standard",
        reporting_period="2024",
        source="Default Weighted Baseline",
        version="1.0.0",
        is_authoritative=False,
        notes="Blended default factor for unsegregated or unknown disposal.",
    ),
}

# Benchmark prices for financial impact models
BENCHMARK_PRICES: Dict[str, float] = {
    "electricity_tariff_inr_per_kwh": 8.50,
    "diesel_inr_per_l": 94.50,
    "petrol_inr_per_l": 104.20,
    "cng_inr_per_kg": 82.00,
    "electric_inr_per_kwh": 8.50,
}


def get_emission_factor(factor_id: str) -> Optional[EmissionFactor]:
    """Retrieves an emission factor by its unique ID."""
    return EMISSION_FACTORS.get(factor_id)


def list_emission_factors() -> List[EmissionFactor]:
    """Returns all registered emission factors in the catalog."""
    return list(EMISSION_FACTORS.values())
