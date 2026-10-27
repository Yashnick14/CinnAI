"""Independent evaluation captures for the app's /validate-sample flow.

CSV uses literal null for unavailable values; images are never training inputs.
The lock serializes CSV writes in the default single-worker backend.
"""
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4
from app.core.config import PROJECT_ROOT

COLLECTION_DIRECTORY = PROJECT_ROOT / "backend_handoff" / "realworld_v5_collection"
FIELDS = ["filename", "timestamp", "v5_detection_count", "v5_max_confidence",
          "coin_detected", "coin_confidence", "quill_detected", "quill_confidence",
          "quill_mask_available", "diameter_success", "diameter_mm",
          "sample_validation_result", "rf_predicted_grade", "final_displayed_grade"]
_lock = Lock()


def write_row(row):
    directory = COLLECTION_DIRECTORY
    with _lock:
        csv_path = directory / "results.csv"
        rows = []
        if csv_path.exists():
            with csv_path.open(newline="", encoding="utf-8") as stream:
                reader = csv.DictReader(stream)
                if reader.fieldnames != FIELDS:
                    raise OSError("Capture CSV header mismatch; existing log preserved")
                rows = list(reader)
        rows = [old for old in rows if old["filename"] != row["filename"]]
        rows.append({key: "null" if row.get(key) is None else str(row[key]).lower() if isinstance(row[key], bool) else row[key] for key in FIELDS})
        temporary = directory / f".results-{uuid4().hex}.tmp"
        try:
            with temporary.open("x", newline="", encoding="utf-8") as stream:
                writer = csv.DictWriter(stream, fieldnames=FIELDS)
                writer.writeheader(); writer.writerows(rows)
                stream.flush(); os.fsync(stream.fileno())
            os.replace(temporary, csv_path)
        finally:
            temporary.unlink(missing_ok=True)


def begin_capture(data):
    now = datetime.now(timezone.utc)
    suffix = ".png" if data.startswith(b"\x89PNG\r\n\x1a\n") else ".jpg"
    filename = now.strftime("%Y%m%dT%H%M%S%fZ") + "_" + uuid4().hex + suffix
    images = COLLECTION_DIRECTORY / "images"
    images.mkdir(parents=True, exist_ok=True)
    with (images / filename).open("xb") as stream:
        stream.write(data)
    row = dict.fromkeys(FIELDS)
    row.update(filename=filename, timestamp=now.isoformat())
    write_row(row)  # A pending row survives interrupted inference.
    return row


def finish_capture(row, result):
    if result is not None:
        diagnostics = result.get("diagnostics", {})
        detector = diagnostics.get("detector") or {}
        diameter = diagnostics.get("diameter")
        visual = diagnostics.get("visual") or {}
        segmentation = (result.get("debug_comparison") or {}).get("segmentation_model") or {}
        row.update(v5_detection_count=detector.get("detected_quills"),
                   v5_max_confidence=max(detector.get("confidences", []), default=None),
                   coin_detected=segmentation.get("coin_detected"), coin_confidence=segmentation.get("coin_confidence"),
                   quill_detected=segmentation.get("quill_detected"), quill_confidence=segmentation.get("quill_confidence"),
                   quill_mask_available=segmentation.get("quill_mask_available"),
                   diameter_success=diameter is not None,
                   diameter_mm=(diameter or {}).get("diameter_mm"),
                   sample_validation_result=result.get("status"), rf_predicted_grade=visual.get("visual_prediction"),
                   final_displayed_grade=result.get("final_grade") if result.get("status") == "VALID" else None)
    write_row(row)
    if result is not None:
        # Preserve complete request-correlated diagnostics without duplicating base64 overlays.
        def compact(value):
            if isinstance(value, dict):
                return {k: compact(v) for k, v in value.items() if k != "diagnostic_overlay"}
            if isinstance(value, list):
                return [compact(v) for v in value]
            return value
        destination = COLLECTION_DIRECTORY / "images" / (row["filename"] + ".validation.json")
        destination.write_text(json.dumps(compact(result), indent=2, allow_nan=False), encoding="utf-8")
