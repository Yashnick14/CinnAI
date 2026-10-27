from unittest.mock import Mock
import pytest
from app.services import sample_decision as decisions
from app.api.routes.diameter import DiagnosticFailure


@pytest.mark.parametrize("count,diameter,error,status,grade", [
    (1, {"diameter_grade": "H1"}, {}, "VALID", "H1"),
    (0, {"diameter_grade": "H1"}, {}, "INVALID", None),
    (1, None, {"quill_missing": True}, "INVALID", None),
    (1, None, {"diameter": "Coin missing"}, "UNCERTAIN", None),
    (1, {"diameter_grade": "Manual review"}, {}, "UNCERTAIN", None),
    (1, {"diameter_grade": "H1"}, {"visual": "Unavailable"}, "UNCERTAIN", None),
])
def test_grade_gate(count, diameter, error, status, grade):
    result = decisions.decide({"detected_quills": count}, {"visual_prediction": "C4"}, diameter, error)
    assert result["status"] == status
    assert result["final_grade"] == grade
    if grade:
        assert result["visual_disagreement"] is True
        assert result["diagnostics"]["visual"]["visual_prediction"] == "C4"


def test_rf_result_cannot_bypass_failed_quill_segmentation(monkeypatch):
    monkeypatch.setattr(decisions, "detect_evidence", lambda *_: {"detected_quills": 1, "confidences": [.8]})
    monkeypatch.setattr(decisions, "process", Mock(side_effect=DiagnosticFailure("No Quill mask detected", {})))
    service = Mock()
    service.predict_visual.return_value = {"visual_prediction": "H2"}
    result = decisions.validate_sample(b"image", "{}", service)
    assert result["status"] == "INVALID"
    assert result["final_grade"] is None
    assert result["diagnostics"]["visual"]["visual_prediction"] == "H2"


def test_combined_endpoint(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes import sample
    from io import BytesIO
    from PIL import Image
    app = FastAPI()
    app.include_router(sample.router)
    app.dependency_overrides[sample.get_visual_service] = lambda: Mock()
    expected = decisions.decide({"detected_quills": 0}, {"visual_prediction": "H2"}, None, {})
    monkeypatch.setattr(sample, "validate_sample", lambda *_: expected)
    image = BytesIO()
    Image.new("RGB", (32, 32)).save(image, "PNG")
    with TestClient(app) as client:
        response = client.post("/validate-sample", files={"image": ("sample.png", image.getvalue(), "image/png")}, data={"capture_geometry": "{}"})
        assert response.status_code == 200
        assert response.json()["final_grade"] is None
        assert response.json()["status"] == "INVALID"


def test_progress_tracks_actual_operations(monkeypatch):
    events = []
    def detector(*args):
        assert events[-1] == ("detector", "running")
        return {"detected_quills": 1}
    def visual(*args):
        assert events[-1] == ("visual", "running")
        return {"visual_prediction": "H2"}
    def diameter(*args):
        assert events[-1] == ("diameter", "running")
        return {"diameter_grade": "H1"}
    monkeypatch.setattr(decisions, "detect_evidence", detector)
    monkeypatch.setattr(decisions, "process", diameter)
    service = Mock(predict_visual=visual)
    result = decisions.validate_sample(b"image", "{}", service, lambda *event: events.append(event))
    assert events == [(step, state) for step in ("detector", "visual", "diameter", "decision") for state in ("running", "passed")]
    assert result["final_grade"] == "H1"


def test_comparison_does_not_replace_legacy_evidence():
    info = {"coin_detected": True, "quill_detected": False, "quill_confidence": None}
    result = decisions.decide({"detected_quills": 1, "confidences": [.78]}, {"visual_prediction": "H2"}, None,
        {"quill_missing": True, "diameter_diagnostics": {"segmentation": {"detection_info": info}}})
    assert result["debug_comparison"] == {"legacy_detector": {"quill_detected": True, "max_confidence": .78}, "segmentation_model": info}
    assert result["status"] == "INVALID"
    assert result["final_grade"] is None


def test_live_stream_order_and_final_result(monkeypatch):
    import asyncio
    import json
    from app.api.routes import sample
    def validate(data, geometry, service, progress):
        progress("detector", "running")
        progress("detector", "failed")
        return {"status": "INVALID", "final_grade": None}
    monkeypatch.setattr(sample, "validate_sample", validate)
    async def collect():
        return [json.loads(line) async for line in sample.live_validation(b"", "{}", None)]
    events = asyncio.run(collect())
    assert [event["type"] for event in events] == ["progress", "progress", "result"]
    assert events[-1]["result"]["final_grade"] is None

def test_breakdown_explains_all_modules_pass_but_manual_review():
    result = decisions.decide(
        {"detected_quills": 1, "confidences": [.8]},
        {"visual_prediction": "H2"},
        {"diameter_grade": "Manual review", "diameter_mm": 34.5,
         "segmentation_model": {"coin_detected": True, "quill_mask_available": True}},
        {},
    )
    debug = result["validation_breakdown"]
    assert debug["quill_detector_pass"] and debug["visual_feature_pass"]
    assert debug["diameter_measurement_valid"]
    assert not debug["sample_validation_pass"]
    assert "34.5" in debug["final_failure_reason"]
    assert "Manual review" in debug["final_failure_reason"]
    assert result["status"] == "UNCERTAIN" and result["final_grade"] is None


def test_breakdown_detector_miss_is_explicit():
    result = decisions.decide({"detected_quills": 0, "confidences": []}, None, None,
                             {"visual": "No quill detected", "diameter": "Coin missing"})
    debug = result["validation_breakdown"]
    assert debug["quill_detector_confidence"] is None
    assert "zero detections at confidence 0.25" in debug["final_failure_reason"]
    assert result["status"] == "INVALID"
