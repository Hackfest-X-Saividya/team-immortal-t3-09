from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

SUPPORTED_FUEL_TYPES = ("Diesel", "Petrol", "CNG", "Electric")
_FUEL_TYPE_MAP = {f.lower(): f for f in SUPPORTED_FUEL_TYPES}


class TransportationCreateRequest(BaseModel):
    date: str = Field(..., description="Date or period of travel (YYYY-MM-DD or YYYY-MM)")
    mode: str = Field(..., description="Transport mode: Bus, Fleet Van, Car, Two-Wheeler, etc.")
    distance_km: float = Field(..., ge=0, description="Total distance travelled in km")
    fuel_type: Optional[str] = Field("Diesel", description="Diesel, Petrol, CNG, Electric")
    fuel_consumed_liters: Optional[float] = Field(None, ge=0, description="Actual fuel consumed in Litres/kg")
    fuel_efficiency_km_per_l: Optional[float] = Field(None, gt=0, description="Fuel efficiency in km/L")
    fuel_expenditure_inr: Optional[float] = Field(None, ge=0, description="Fuel expense in INR")
    vehicle_id: Optional[str] = Field(None, max_length=50)
    passenger_count: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("fuel_type")
    @classmethod
    def validate_fuel_type(cls, v: Optional[str]) -> str:
        if v is None:
            return "Diesel"
        cleaned = v.strip()
        matched = _FUEL_TYPE_MAP.get(cleaned.lower())
        if not matched:
            supported = ", ".join(SUPPORTED_FUEL_TYPES)
            raise ValueError(f"Invalid fuel type '{v}'. Supported fuel types are: {supported}")
        return matched


class TransportationUpdateRequest(BaseModel):
    date: Optional[str] = None
    mode: Optional[str] = None
    distance_km: Optional[float] = Field(None, ge=0)
    fuel_type: Optional[str] = None
    fuel_consumed_liters: Optional[float] = Field(None, ge=0)
    fuel_efficiency_km_per_l: Optional[float] = Field(None, gt=0)
    fuel_expenditure_inr: Optional[float] = Field(None, ge=0)
    vehicle_id: Optional[str] = None
    passenger_count: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None

    @field_validator("fuel_type")
    @classmethod
    def validate_fuel_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        matched = _FUEL_TYPE_MAP.get(cleaned.lower())
        if not matched:
            supported = ", ".join(SUPPORTED_FUEL_TYPES)
            raise ValueError(f"Invalid fuel type '{v}'. Supported fuel types are: {supported}")
        return matched


class TransportationRecordResponse(BaseModel):
    id: str
    workspace_id: str
    date: str
    mode: str
    distance_km: float
    fuel_type: Optional[str] = None
    fuel_consumed_liters: Optional[float] = None
    fuel_efficiency_km_per_l: Optional[float] = None
    fuel_expenditure_inr: Optional[float] = None
    vehicle_id: Optional[str] = None
    passenger_count: Optional[int] = None
    notes: Optional[str] = None
    calculation_method: str
    calculated_emissions_kg: float
    created_at: str
    updated_at: str


class TransportationSummaryResponse(BaseModel):
    total_distance_km: float
    total_fuel_liters: float
    total_expenditure_inr: float
    total_calculated_emissions_kg: float
    record_count: int
    mode_breakdown: List[Dict[str, Any]]
    monthly_trends: List[Dict[str, Any]]
