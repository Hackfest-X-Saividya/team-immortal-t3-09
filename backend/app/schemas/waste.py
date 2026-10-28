from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class WasteCreateRequest(BaseModel):
    date: str = Field(..., description="Date or period (YYYY-MM-DD or YYYY-MM)")
    category: str = Field(..., description="Biodegradable, Recyclable, General, E-waste")
    quantity_kg: float = Field(..., ge=0, description="Waste generated in kilograms")
    treatment_method: Optional[str] = Field("Other / Unknown", description="Composting, Recycling, Landfill, Other / Unknown")
    building_or_department: Optional[str] = None
    collection_provider: Optional[str] = None
    disposal_cost_inr: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class WasteUpdateRequest(BaseModel):
    date: Optional[str] = None
    category: Optional[str] = None
    quantity_kg: Optional[float] = Field(None, ge=0)
    treatment_method: Optional[str] = None
    building_or_department: Optional[str] = None
    collection_provider: Optional[str] = None
    disposal_cost_inr: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class WasteRecordResponse(BaseModel):
    id: str
    workspace_id: str
    date: str
    category: str
    quantity_kg: float
    treatment_method: Optional[str] = None
    building_or_department: Optional[str] = None
    collection_provider: Optional[str] = None
    disposal_cost_inr: Optional[float] = None
    notes: Optional[str] = None
    calculated_emissions_kg: float
    emission_factor_used: Optional[float] = None
    status: str = "Verified"
    created_at: str
    updated_at: str


class WasteSummaryResponse(BaseModel):
    total_waste_kg: float
    recycled_waste_kg: float
    recycling_rate_percent: Optional[float] = None
    total_calculated_emissions_kg: float
    record_count: int
    category_breakdown: List[Dict[str, Any]]
    treatment_breakdown: List[Dict[str, Any]]
    monthly_trends: List[Dict[str, Any]]
