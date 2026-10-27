from types import SimpleNamespace
from unittest.mock import Mock
import numpy as np
import pytest
from app.core.config import SUPPORTED_GRADES
from app.ml.visual import service as module
from app.ml.visual.service import FEATURE_COLUMNS, ModelContractError, NoUsableQuillsError, VisualModelService

def setup(boxes):
    detector = Mock()
    detector.names = {0: "Quill"}
    detector.predict.return_value = [SimpleNamespace(boxes=boxes)]
    rf = Mock()
    rf.classes_ = np.array(SUPPORTED_GRADES)
    rf.feature_names_in_ = np.array(FEATURE_COLUMNS)
    rf.n_features_in_ = 21
    rf.predict_proba.return_value = [[0.1, 0.3, 0.2, 0.1, 0.1, 0.1, 0.05, 0.05]]
    service = VisualModelService(detector, {"model": rf, "features": list(FEATURE_COLUMNS), "classes": list(SUPPORTED_GRADES)})
    return service, detector, rf

def box(coords):
    tensor = Mock()
    tensor.cpu.return_value.numpy.return_value = np.asarray(coords, dtype=float)
    return SimpleNamespace(xyxy=[tensor])

def feature_mocks(monkeypatch):
    monkeypatch.setattr(module.features, "extract_colour_features", lambda *_: {name: 1.0 for name in module.features.colour_feature_names})
    monkeypatch.setattr(module.features, "extract_surface_features", lambda *_: {name: 1.0 for name in module.features.surface_feature_names})

def test_all_boxes_used_without_later_plausibility_filter(monkeypatch):
    service, detector, _ = setup([box([0, 0, 95, 95]), box([10, 10, 20, 90])])
    seen = []
    def mask(image, coords):
        seen.append(coords.tolist())
        return np.ones((20, 20, 3), dtype=np.uint8), np.ones((20, 20), dtype=np.uint8) * 255
    monkeypatch.setattr(module.features, "create_quill_mask_v2", mask)
    feature_mocks(monkeypatch)
    detected, usable, row = service.extract_image_features(np.zeros((100, 100, 3), dtype=np.uint8))
    assert (detected, usable) == (2, 2)
    assert len(seen) == 2  # Includes the giant square that cell 141 would reject.
    kwargs = detector.predict.call_args.kwargs
    assert kwargs["conf"] == 0.25 and kwargs["imgsz"] == 640 and kwargs["device"] == "cpu"
    assert "iou" not in kwargs
    assert list(row) == list(FEATURE_COLUMNS)

def test_failed_individual_detection_does_not_discard_valid_quill(monkeypatch):
    service, _, _ = setup([box([0, 0, 10, 10]), box([0, 0, 20, 90])])
    monkeypatch.setattr(module.features, "create_quill_mask_v2", Mock(side_effect=[(None, None), (np.ones((20, 20, 3), np.uint8), np.full((20, 20), 255, np.uint8))]))
    feature_mocks(monkeypatch)
    detected, usable, _ = service.extract_image_features(np.zeros((100, 100, 3), np.uint8))
    assert (detected, usable) == (2, 1)

def test_no_detections():
    service, _, _ = setup([])
    with pytest.raises(NoUsableQuillsError, match="No quill detected"):
        service.extract_image_features(np.zeros((100, 100, 3), np.uint8))

def test_no_usable_features(monkeypatch):
    service, _, _ = setup([box([0, 0, 10, 10])])
    monkeypatch.setattr(module.features, "create_quill_mask_v2", lambda *_: (None, None))
    with pytest.raises(NoUsableQuillsError, match="no usable"):
        service.extract_image_features(np.zeros((100, 100, 3), np.uint8))

def test_reordered_feature_metadata_rejected():
    _, detector, rf = setup([])
    with pytest.raises(ModelContractError, match="feature list/order"):
        VisualModelService(detector, {"model": rf, "features": list(reversed(FEATURE_COLUMNS)), "classes": list(SUPPORTED_GRADES)})
