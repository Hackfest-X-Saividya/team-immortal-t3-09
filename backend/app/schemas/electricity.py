from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from app.utils.dates import normalize_month


class ElectricityCreateRequest(BaseModel):
    reporting_month: str = Field(..., description="Reporting month (YYYY-MM or YYYY-MM-DD)")
    consumption_kwh: float = Field(..., ge=0, description="Electricity consumption in kWh")
    bill_amount_inr: Optional[float] = Field(None, ge=0, description="Optional recorded bill amount in INR")
    building_or_department: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("reporting_month")
    @classmethod
    def validate_month(cls, v: str) -> str:
        norm = normalize_month(v)
        if len(norm) != 7 or norm[4] != "-":
            raise ValueError("Reporting month must be in format YYYY-MM")
        return norm


class ElectricityUpdateRequest(BaseModel):
    reporting_month: Optional[str] = None
    consumption_kwh: Optional[float] = Field(None, ge=0)
    bill_amount_inr: Optional[float] = Field(None, ge=0)
    building_or_department: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("reporting_month")
    @classmethod
    def validate_month(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            norm = normalize_month(v)
            if len(norm) != 7 or norm[4] != "-":
                raise ValueError("Reporting month must be in format YYYY-MM")
            return norm
        return v


class ElectricityRecordResponse(BaseModel):
    id: str
    workspace_id: str
    reporting_month: str
    consumption_kwh: float
    bill_amount_inr: Optional[float] = None
    building_or_department: Optional[str] = None
    notes: Optional[str] = None
    calculated_emissions_kg: float
    emission_factor_used: float
    factor_type: str
    created_at: str
    updated_at: str


class MonthlyElectricityTrend(BaseModel):
    reporting_month: str
    consumption_kwh: float
    bill_amount_inr: float
    calculated_emissions_kg: float


class ElectricitySummaryResponse(BaseModel):
    total_consumption_kwh: float
    total_bill_inr: float
    total_calculated_emissions_kg: float
    record_count: int
    monthly_trends: List[MonthlyElectricityTrend]
    department_breakdown: List[Dict[str, Any]]
    previous_period_comparison: Optional[Dict[str, Any]] = None
