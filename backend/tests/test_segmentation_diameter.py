from app.services import diameter_service
from types import SimpleNamespace
from unittest.mock import Mock

import cv2
import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.ml.measurement import config, segmentation_diameter as measurement
from app.ml.measurement.controlled import Geometry
from app.ml.segmentation import service as models


class Tensor:
    def __init__(self, values):
        self.values = np.asarray(values)

    def cpu(self):
        return self

    def numpy(self):
        return self.values


def detector(classes, scores, masks):
    result = SimpleNamespace(boxes=SimpleNamespace(cls=Tensor(classes), conf=Tensor(scores)),
                             masks=SimpleNamespace(data=Tensor(masks)))
    # Deliberately reversed IDs: selection must use names.
    return SimpleNamespace(names={0: "Quill", 1: "Coin"}, task="segment",
                           predict=Mock(return_value=[result]))


def sample():
    coin = np.zeros((500, 400), np.uint8)
    quill = coin.copy()
    cv2.circle(coin, (80, 300), 50, 1, -1)
    quill[50:450, 250:330] = 1
    _, encoded = cv2.imencode(".png", np.full((500, 400, 3), 220, np.uint8))
    geometry = Geometry.model_validate(dict(version=1, mapping="ios-preview-cropped",
        image_width=400, image_height=500, preview_width=400, preview_height=500,
        coin=dict(x=.02, y=.45, width=.36, height=.288),
        quill=dict(x=.55, y=.05, width=.4, height=.9)))
    return coin, quill, encoded.tobytes(), geometry


def test_highest_confidence_by_class_name_and_prediction_options():
    coin, quill, _, _ = sample()
    model = detector([1, 0, 1, 0], [.4, .5, .95, .85], [quill, coin, coin, quill])
    image = np.zeros((500, 400, 3), np.uint8)
    prediction = models.SegmentationModelService(model).predict(image)
    np.testing.assert_array_equal(prediction.coin_mask, coin)
    np.testing.assert_array_equal(prediction.quill_mask, quill)
    assert prediction.coin_confidence == .95
    assert prediction.quill_confidence == .85
    assert prediction.detection_info["coin_detection_count"] == 2
    assert prediction.detection_info["quill_detection_count"] == 2
    model.predict.assert_called_once_with(source=image, imgsz=640, conf=.25,
                                         retina_masks=True, device="cpu", verbose=False)


@pytest.mark.parametrize("classes,coin,quill", [([1], True, False), ([0], False, True), ([], False, False)])
def test_partial_detection_comparison_survives_measurement_failure(classes, coin, quill):
    masks = np.ones((len(classes), 10, 10), np.uint8)
    model = detector(classes, [.9] * len(classes), masks)
    with pytest.raises(models.SegmentationDetectionError) as failure:
        models.SegmentationModelService(model).predict(np.zeros((10, 10, 3)))
    info = failure.value.evidence["detection_info"]
    assert info["coin_detected"] == coin
    assert info["quill_detected"] == quill
    assert info["coin_detection_count"] == int(coin)
    assert info["quill_detection_count"] == int(quill)
    assert info["coin_confidence"] == (.9 if coin else None)
    assert info["quill_confidence"] == (.9 if quill else None)
    assert info["segmentation_available"] == bool(classes)


def test_boxes_without_masks_still_report_detection():
    model = detector([1], [.9], np.ones((1, 10, 10)))
    model.predict.return_value[0].masks = None
    with pytest.raises(models.SegmentationDetectionError) as failure:
        models.SegmentationModelService(model).predict(np.zeros((10, 10, 3)))
    assert failure.value.evidence["detection_info"]["coin_detected"] is True
    assert failure.value.evidence["detection_info"]["segmentation_available"] is False


@pytest.mark.parametrize("class_id,missing", [(0, "Coin"), (1, "Quill")])
def test_missing_class(class_id, missing):
    model = detector([class_id], [.9], [np.ones((10, 10))])
    with pytest.raises(models.SegmentationDetectionError, match=missing):
        models.SegmentationModelService(model).predict(np.zeros((10, 10, 3)))


def test_missing_checkpoint_and_lazy_retry(tmp_path, monkeypatch):
    with pytest.raises(models.SegmentationUnavailableError, match="missing"):
        models.SegmentationModelService.load(tmp_path)
    service = object()
    loader = Mock(side_effect=[models.SegmentationUnavailableError("missing"), service])
    monkeypatch.setattr(models, "_service", None)
    monkeypatch.setattr(models.SegmentationModelService, "load", loader)
    with pytest.raises(models.SegmentationUnavailableError):
        models.get_segmentation_service()
    assert models.get_segmentation_service() is service
    assert models.get_segmentation_service() is service
    assert loader.call_count == 2


def test_valid_measurement_reuses_grade_function(monkeypatch):
    coin, quill, data, geometry = sample()
    grade = Mock(return_value="existing grade function")
    monkeypatch.setattr(config, "diameter_grade", grade)
    service = Mock(predict=Mock(return_value=models.SegmentationPrediction(coin, quill, .9, .8)))
    result, overlay = measurement.measure(data, geometry, service=service)
    assert result["coin_diameter_px"] == pytest.approx(100, abs=.001)
    assert result["pixels_per_mm"] == result["coin_diameter_px"] / 26.4
    assert result["quill_width_px"] == 80
    assert result["raw_diameter_mm"] == pytest.approx(21.12, abs=.001)
    assert result["diameter_mm"] == pytest.approx(19.62, abs=.001)
    assert result["quill_diameter_mm"] == result["diameter_mm"]
    assert result["raw_valid_rows"] == result["filtered_rows"] == result["valid_rows"] == 160
    grade.assert_called_once_with(result["diameter_mm"])
    assert result["diameter_grade"] == "existing grade function"
    assert overlay.startswith(b"\x89PNG")


def test_resize_uses_nearest_neighbour():
    mask = np.array([[1, 0], [0, 1]], np.uint8)
    np.testing.assert_array_equal(measurement.original_size_mask(mask, 4, 4),
                                  np.repeat(np.repeat(mask, 2, axis=0), 2, axis=1))


def test_service_returns_full_resolution_binary_masks():
    mask = np.array([[1, 0], [0, 1]], np.float32)
    model = detector([1, 0], [.9, .8], [mask, mask])
    prediction = models.SegmentationModelService(model).predict(np.zeros((8, 6, 3), np.uint8))
    expected = cv2.resize(mask.astype(np.uint8), (6, 8), interpolation=cv2.INTER_NEAREST)
    for actual in (prediction.coin_mask, prediction.quill_mask):
        assert actual.dtype == np.uint8
        np.testing.assert_array_equal(actual, expected)


def test_central_band_mad_filter():
    mask = np.zeros((101, 100), np.uint8)
    mask[:, 10:30] = 1
    for y in range(30, 70):
        mask[y] = 0
        width = [19, 20, 21, 60][(y-30) % 4]
        mask[y, 10:10+width] = 1
    rows, keep, width, mad, band = measurement.central_widths(mask)
    assert band == (30, 70)
    assert len(rows) == 40 and keep.sum() == 30
    assert mad == 1 and width == 20


@pytest.mark.parametrize("failure,status", [(None, 200),
    (models.SegmentationDetectionError("No Coin mask detected"), 422),
    (models.SegmentationDetectionError("No Quill mask detected"), 422),
    (models.SegmentationUnavailableError("model is missing"), 503)])
def test_endpoint_contract_and_upload_retention(monkeypatch, tmp_path, failure, status):
    from app.api.routes import diameter
    from app.services.temporary_uploads import save_temporary_visual_upload
    coin, quill, data, geometry = sample()
    service = Mock()
    service.predict.return_value = models.SegmentationPrediction(coin, quill, .9, .8)
    service.predict.side_effect = failure
    monkeypatch.setattr(measurement, "get_segmentation_service", lambda: service)
    monkeypatch.setattr(diameter_service, "save_temporary_visual_upload",
                        lambda content: save_temporary_visual_upload(content, tmp_path))
    app = FastAPI()
    app.include_router(diameter.router)
    with TestClient(app) as client:
        response = client.post("/measure-diameter", files={"image": ("sample.png", data, "image/png")},
                               data={"capture_geometry": geometry.model_dump_json()})
    assert response.status_code == status
    result = response.json()
    assert list(tmp_path.glob("*.geometry.json"))
    assert list(tmp_path.glob("*.coin-diagnostics.json"))
    from pathlib import Path
    assert Path(result["coin_diagnostics"]["artifacts"]["original"]).read_bytes() == data
    if status == 200:
        assert result["diameter_mm"] == result["quill_diameter_mm"]
        assert result["valid_rows"] == result["filtered_rows"]
        assert result["coin_confidence"] == .9
        assert result["quill_confidence"] == .8
        assert list(tmp_path.glob("*.overlay.png"))
    else:
        assert str(failure) in result["detail"]

def test_refinement_preserves_clean_quill():
    _, mask, _, _ = sample()
    refined = measurement.refine_quill_mask(mask)
    np.testing.assert_array_equal(refined, mask)
    assert measurement.central_widths(refined)[2] == 80


def test_refinement_removes_thin_attached_extensions():
    _, mask, _, _ = sample()
    # One-pixel horizontal protrusions on most central rows, separated by gaps.
    for y in range(169, 329):
        if y % 3 != 0:
            mask[y, 330:350] = 1
    old_width = measurement.central_widths(mask)[2]
    refined = measurement.refine_quill_mask(mask)
    assert old_width == 100
    assert measurement.central_widths(refined)[2] == 80


def test_refinement_removes_detached_peripheral_noise():
    _, mask, _, _ = sample()
    mask[180:320, 370] = 1
    assert measurement.central_widths(mask)[2] == 121
    assert measurement.central_widths(measurement.refine_quill_mask(mask))[2] == 80


@pytest.mark.parametrize("thin", [False, True])
def test_refinement_rejects_empty_or_unusable_mask(thin):
    mask = np.zeros((100, 100), np.uint8)
    if thin:
        mask[10:90, 50] = 1
    with pytest.raises(ValueError, match="Quill"):
        measurement.refine_quill_mask(mask)


def test_refinement_diagnostics_and_coin_scale_unchanged():
    coin, quill, data, geometry = sample()
    service = Mock(predict=Mock(return_value=models.SegmentationPrediction(coin, quill, .9, .8)))
    diagnostics = {"report": {}, "images": {}}
    result, _ = measurement.measure(data, geometry, diagnostics, service=service)
    np.testing.assert_array_equal(diagnostics["images"]["quill-mask"], quill * 255)
    np.testing.assert_array_equal(diagnostics["images"]["quill-mask-refined"], quill * 255)
    assert "quill-measurement-rows" in diagnostics["images"]
    assert len(diagnostics["report"]["measurement_rows"]) == 160
    assert diagnostics["report"]["quill_refinement"]["extra_erosion_iterations"] == 0
    assert result["coin_diameter_px"] == pytest.approx(100, abs=.001)
    assert result["quill_width_px"] == 80
    assert result["raw_diameter_mm"] == pytest.approx(21.12, abs=.001)
    assert result["diameter_mm"] == pytest.approx(19.62, abs=.001)

@pytest.mark.parametrize("enabled", [True, False])
def test_prototype_calibration_switch_preserves_raw(monkeypatch, enabled):
    monkeypatch.setattr(config, "USE_DIAMETER_CALIBRATION", enabled)
    coin, quill, data, geometry = sample()
    service = Mock(predict=Mock(return_value=models.SegmentationPrediction(coin, quill, .9, .8)))
    result, _ = measurement.measure(data, geometry, service=service)
    raw = result["quill_width_px"] / result["pixels_per_mm"]
    assert result["raw_diameter_mm"] == raw
    assert result["calibrated_diameter_mm"] == max(raw - 1.5, 0)
    expected = max(raw - 1.5, 0) if enabled else raw
    assert result["diameter_mm"] == result["quill_diameter_mm"] == expected
    assert result["diameter_grade"] == config.diameter_grade(expected)


def test_calibration_clamps_at_zero():
    assert config.diameter_calibration(1)["calibrated_diameter_mm"] == 0

@pytest.mark.parametrize("raw,expected,grade", [
    (29.0, 27.5, "H2"), (23.0, 21.5, "H1"), (21.0, 19.5, "M4"),
    (19.0, 17.5, "M5"), (18.0, 16.5, "M5"), (14.0, 12.5, "C4"),
])
def test_active_prototype_examples(raw, expected, grade):
    result = config.diameter_calibration(raw)
    assert config.USE_DIAMETER_CALIBRATION is True
    assert config.DIAMETER_CALIBRATION_OFFSET_MM == 1.5
    assert result["raw_diameter_mm"] == raw
    assert result["calibrated_diameter_mm"] == expected
    assert result["grading_diameter_mm"] == expected
    assert config.diameter_grade(result["grading_diameter_mm"]) == grade


@pytest.mark.parametrize("boundary", [10, 12, 16, 18, 21, 25])
def test_calibrated_manual_review_boundaries_unchanged(boundary):
    result = config.diameter_calibration(boundary + config.DIAMETER_CALIBRATION_OFFSET_MM)
    assert config.diameter_grade(result["grading_diameter_mm"]) == "Manual review"
