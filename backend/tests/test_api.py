from io import BytesIO
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.api.routes import visual
from app.core.config import SUPPORTED_GRADES
from app.ml.visual.service import NoUsableQuillsError
from app.services.temporary_uploads import save_temporary_visual_upload

def image_file():
    stream = BytesIO()
    Image.new("RGB", (32, 32), "white").save(stream, format="JPEG")
    return ("sample.jpg", stream.getvalue(), "image/jpeg")

@pytest.fixture
def client(monkeypatch, tmp_path):
    service = Mock()
    service.predict_visual.return_value = {
        "detected_quills": 1, "visual_prediction": "C4", "visual_confidence": 0.5,
        "probabilities": {grade: 0.5 if grade in ("C4", "C5") else 0.0 for grade in SUPPORTED_GRADES},
    }
    monkeypatch.setattr("app.main.VisualModelService.load", lambda: service)
    monkeypatch.setattr(visual, "save_temporary_visual_upload", lambda data: save_temporary_visual_upload(data, tmp_path))
    app.dependency_overrides[visual.get_visual_service] = lambda: service
    with TestClient(app) as active:
        yield active, service
    app.dependency_overrides.clear()

def test_health_and_only_visual_routes(client):
    api, _ = client
    assert api.get("/health").json() == {"status": "ok"}
    assert set(api.get("/openapi.json").json()["paths"]) == {"/health", "/predict-visual", "/measure-diameter", "/validate-sample", "/assistant/ask"}
    assert api.post("/api/v1/grade").status_code == 404

def test_visual_contract(client):
    api, service = client
    response = api.post("/predict-visual", files={"image": image_file()})
    assert response.status_code == 200
    result = response.json()
    assert set(result) == {"detected_quills", "visual_prediction", "visual_confidence", "probabilities"}
    assert list(result["probabilities"]) == list(SUPPORTED_GRADES)
    assert sum(result["probabilities"].values()) == pytest.approx(1)
    service.predict_visual.assert_called_once()

def test_upload_validation(client, monkeypatch):
    api, service = client
    assert api.post("/predict-visual").status_code == 422
    for data in (b"", b"not-an-image"):
        assert api.post("/predict-visual", files={"image": ("bad.jpg", data, "image/jpeg")}).status_code == 400
    assert api.post("/predict-visual", files={"image": ("bad.txt", b"text", "text/plain")}).status_code == 415
    monkeypatch.setattr(visual, "MAX_IMAGE_BYTES", 10)
    assert api.post("/predict-visual", files={"image": image_file()}).status_code == 413
    service.predict_visual.assert_not_called()

def test_no_usable_quills_is_clear_error(client):
    api, service = client
    service.predict_visual.side_effect = NoUsableQuillsError("No usable quill features remained.")
    response = api.post("/predict-visual", files={"image": image_file()})
    assert response.status_code == 422
    assert "No usable" in response.json()["detail"]

def test_inference_failure_is_not_a_mock_result(client):
    api, service = client
    service.predict_visual.side_effect = RuntimeError("internal failure")
    response = api.post("/predict-visual", files={"image": image_file()})
    assert response.status_code == 503
    assert "internal failure" not in response.text

def test_unavailable_models_is_503(client):
    api, _ = client
    app.dependency_overrides.clear()
    app.state.visual_service = None
    assert api.post("/predict-visual", files={"image": image_file()}).status_code == 503

@pytest.mark.parametrize("failure", [None, NoUsableQuillsError("No quill detected."), RuntimeError("inference failed")])
def test_original_is_retained_even_when_detection_or_inference_fails(client, tmp_path, failure):
    api, service = client
    service.predict_visual.side_effect = failure
    photo = image_file()
    result = api.post("/predict-visual", files={"image": photo})
    assert result.status_code == (200 if failure is None else 422 if isinstance(failure, NoUsableQuillsError) else 503)
    saved = list(tmp_path.glob("*.jpg"))
    assert len(saved) == 1
    assert saved[0].read_bytes() == photo[1]

def test_invalid_upload_is_not_saved(client, tmp_path):
    api, _ = client
    assert api.post("/predict-visual", files={"image": ("bad.jpg", b"not a photo", "image/jpeg")}).status_code == 400
    assert list(tmp_path.iterdir()) == []

def test_storage_failure_is_explicit(client, monkeypatch):
    api, service = client
    def fail(_data):
        raise OSError("disk full")
    monkeypatch.setattr(visual, "save_temporary_visual_upload", fail)
    assert api.post("/predict-visual", files={"image": image_file()}).status_code == 507
    service.predict_visual.assert_not_called()

def test_png_bytes_are_saved_as_png_and_uploads_do_not_overwrite(tmp_path):
    out = BytesIO()
    Image.new("RGB", (16, 16), "white").save(out, format="PNG")
    first = save_temporary_visual_upload(out.getvalue(), tmp_path)
    second = save_temporary_visual_upload(out.getvalue(), tmp_path)
    assert first != second and first.suffix == ".png"
    assert first.read_bytes() == second.read_bytes() == out.getvalue()

