from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, Field

Grade = Literal["Alba", "C4", "C5", "C5 Special", "H1", "H2", "M4", "M5"]
Scenario = Literal["accepted", "moisture_fail", "manual_review", "measurement_error", "no_quill"]
Probability = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]

class GradingResult(BaseModel):
    id: UUID
    timestamp: datetime
    is_mock: bool = True
    detected_quill_count: int = Field(ge=0)
    visual_prediction: Grade | None
    visual_confidence: Probability | None
    visual_probabilities: dict[Grade, Probability]
    diameter_mm: float | None = Field(gt=0, allow_inf_nan=False)
    diameter_candidates: list[Grade]
    candidate_probabilities: dict[Grade, Probability]
    final_candidate_confidence: Probability | None
    moisture_percent: float | None = Field(ge=0, le=100, allow_inf_nan=False)
    moisture_status: Literal["PASS", "FAIL", "UNAVAILABLE"]
    final_grade: Grade | None
    final_status: Literal["GRADE_ACCEPTED", "MANUAL_REVIEW", "MOISTURE_NON_COMPLIANT", "MEASUREMENT_ERROR"]
    warnings: list[str]

class StoredGradingResult(GradingResult):
    image_url: str

