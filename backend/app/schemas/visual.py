from typing import Literal
from pydantic import BaseModel, Field

class VisualPrediction(BaseModel):
    detected_quills: int = Field(ge=1)
    visual_prediction: Literal["Alba", "C4", "C5", "C5 Special", "H1", "H2", "M4", "M5"]
    visual_confidence: float = Field(ge=0, le=1, allow_inf_nan=False)
    probabilities: dict[str, float]
