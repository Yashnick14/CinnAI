from pydantic import BaseModel, ConfigDict, Field


class AssistantQuestion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    question: str = Field(min_length=1, max_length=4000, strict=True)


class AssistantAnswer(BaseModel):
    answer: str
    detected_diameter_mm: float | None = None
    application_grade: str | None = None
