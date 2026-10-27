"""Explicit demo fixtures, NOT an ML or physical measurement implementation."""
from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4
from app.core.config import MOISTURE_LIMIT_PERCENT, SUPPORTED_GRADES
from app.schemas.grading import GradingResult, Scenario

class GradingService(Protocol):
    def grade(self, image: bytes, moisture_percent: float | None, scenario: Scenario) -> GradingResult: ...

class MockGradingService:
    def grade(self, image: bytes, moisture_percent: float | None, scenario: Scenario = "accepted") -> GradingResult:
        # Image is validated by the route, but NOT analysed here.
        result = GradingResult(
            id=uuid4(), timestamp=datetime.now(timezone.utc), is_mock=True,
            detected_quill_count=1, visual_prediction="M4", visual_confidence=0.71,
            visual_probabilities={"Alba": 0.01, "C4": 0.02, "C5": 0.01, "C5 Special": 0.01, "H1": 0.08, "H2": 0.03, "M4": 0.71, "M5": 0.13},
            diameter_mm=23.0, diameter_candidates=["H1", "M4", "M5"],
            candidate_probabilities={"H1": 0.08, "M4": 0.71, "M5": 0.13},
            final_candidate_confidence=0.71 / 0.92, final_grade="M4",
            moisture_percent=moisture_percent,
            moisture_status="UNAVAILABLE" if moisture_percent is None else "PASS" if moisture_percent < MOISTURE_LIMIT_PERCENT else "FAIL",
            final_status="GRADE_ACCEPTED",
            warnings=["DEMO ONLY: the image was not analysed. Grade, diameter and probabilities are illustrative fixtures."],
        )
        if scenario == "moisture_fail":
            result.moisture_percent = 15.1
            result.moisture_status = "FAIL"
            result.warnings.append("Demo scenario supplies an illustrative moisture reading of 15.1%.")
        if result.moisture_status == "FAIL":
            result.final_status = "MOISTURE_NON_COMPLIANT"
        if result.moisture_status == "UNAVAILABLE":
            result.final_status = "MANUAL_REVIEW"
            result.warnings.append("No fresh moisture reading was available. Compliance cannot be established.")
        if scenario == "manual_review":
            result.visual_prediction = "Alba"
            result.visual_confidence = 1.0
            result.visual_probabilities = {grade: 1.0 if grade == "Alba" else 0.0 for grade in SUPPORTED_GRADES}
            result.candidate_probabilities = {"H1": 0, "M4": 0, "M5": 0}
            result.final_grade = None
            result.final_candidate_confidence = None
            result.final_status = "MANUAL_REVIEW"
            result.warnings.append("Illustrative visual and diameter conflict: compatible grades have no visual support.")
        if scenario in ("measurement_error", "no_quill"):
            result.diameter_mm = None
            result.diameter_candidates = []
            result.candidate_probabilities = {}
            result.final_grade = None
            result.final_candidate_confidence = None
            result.final_status = "MEASUREMENT_ERROR"
            result.warnings.append("Illustrative measurement failure: reference coin or reliable quill measurement unavailable.")
        if scenario == "no_quill":
            result.detected_quill_count = 0
            result.visual_prediction = None
            result.visual_confidence = None
            result.visual_probabilities = {grade: 0.0 for grade in SUPPORTED_GRADES}
            result.warnings.append("Illustrative detection failure: no quill detected.")
        return result

def get_grading_service() -> GradingService:
    # TODO: Supply a real implementation only after the original models and pipeline arrive.
    return MockGradingService()

