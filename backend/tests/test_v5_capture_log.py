import csv
from concurrent.futures import ThreadPoolExecutor
from app.services import v5_capture_log as log


def rows():
    with (log.COLLECTION_DIRECTORY / "results.csv").open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def test_original_saved_before_inference_and_one_row(monkeypatch):
    from app.api.routes import sample
    data = b"original-upload-bytes"
    def validate(*args):
        pending = rows()
        assert len(pending) == 1
        assert (log.COLLECTION_DIRECTORY / "images" / pending[0]["filename"]).read_bytes() == data
        assert pending[0]["final_displayed_grade"] == "null"
        return {"status": "INVALID", "final_grade": None,
            "diagnostics": {"detector": {"detected_quills": 0, "confidences": []}, "diameter": None, "visual": None},
            "debug_comparison": {"segmentation_model": {"coin_detected": True, "coin_confidence": .9, "quill_detected": False, "quill_confidence": None, "quill_mask_available": False}}}
    monkeypatch.setattr(sample, "validate_sample", validate)
    sample.logged_validation(data, "{}", None)
    assert len(rows()) == 1
    row = rows()[0]
    assert row["v5_detection_count"] == "0"
    assert row["v5_max_confidence"] == "null"
    assert row["coin_detected"] == "true"
    assert row["quill_mask_available"] == "false"
    assert row["diameter_success"] == "false"
    assert row["sample_validation_result"] == "INVALID"


def test_concurrent_captures_unique_and_no_lost_rows():
    with ThreadPoolExecutor(max_workers=4) as pool:
        captures = list(pool.map(log.begin_capture, [b"photo"] * 12))
        list(pool.map(lambda row: log.finish_capture(row, None), captures))
    assert len(rows()) == 12
    assert len({row["filename"] for row in rows()}) == 12
    assert len(list((log.COLLECTION_DIRECTORY / "images").iterdir())) == 12


def test_valid_fields():
    row = log.begin_capture(b"photo")
    log.finish_capture(row, {"status": "VALID", "final_grade": "H1", "diagnostics": {
        "detector": {"detected_quills": 2, "confidences": [.7, .9]},
        "diameter": {"diameter_mm": 24}, "visual": {"visual_prediction": "H2"}},
        "debug_comparison": {"segmentation_model": {"quill_mask_available": True}}})
    saved = rows()[0]
    assert saved["v5_max_confidence"] == "0.9"
    assert saved["diameter_mm"] == "24"
    assert saved["rf_predicted_grade"] == "H2"
    assert saved["final_displayed_grade"] == "H1"
