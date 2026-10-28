from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AiChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=500, description="User question to the AI Sustainability Advisor")


class CalculationBreakdown(BaseModel):
    formula: str
    inputs: Dict[str, Any]
    assumptions: Optional[List[str]] = None
    result: str


class AiChatResponse(BaseModel):
    id: str
    role: str = "assistant"
    content: str
    timestamp: str
    calculation_breakdown: Optional[CalculationBreakdown] = None
    suggested_follow_ups: List[str] = Field(default_factory=list)
