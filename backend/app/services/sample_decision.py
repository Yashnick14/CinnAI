"""Gate user-facing grades without changing either inference pipeline."""
import logging
import hashlib
import json
import cv2
import numpy as np
from app.services.diameter_service import process, DiagnosticFailure
from app.ml.visual.service import NoUsableQuillsError


def detect_evidence(service, data):
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    with service._lock:
        results = service.detector.predict(source=image, imgsz=640, conf=.25,
                                           device="cpu", verbose=False)
        boxes = results[0].boxes
        scores = [] if boxes is None else boxes.conf.cpu().numpy().tolist()
    return {"detected_quills": len(scores), "confidences": scores,
            "max_confidence": max(scores, default=None),
            "image_sha256": hashlib.sha256(data).hexdigest(),
            "image_dimensions": {"width": int(image.shape[1]), "height": int(image.shape[0])},
            "inference_size": 640, "confidence_threshold": .25,
            "below_threshold_detections": None,
            "below_threshold_reason": "Not observable from confidence-filtered outputs; no lower-threshold inference performed.",
            "preprocessing": "Original upload bytes decoded by OpenCV to BGR; no application crop/resize; Ultralytics letterboxes internally."}


def decide(detector, visual, diameter, errors):
    status = "VALID"
    message = "Sample verified. Grade is based on diameter; visual prediction is supporting evidence."
    if (detector is not None and detector["detected_quills"] == 0) or errors.get("quill_missing"):
        status = "INVALID"
        message = "Sample could not be verified as a valid cinnamon quill. Please recapture the image."
    elif errors or not detector or not visual or not diameter or diameter["diameter_grade"] == "Manual review":
        status = "UNCERTAIN"
        message = "Sample validation is incomplete or requires manual review. Please recapture or request review."
    disagreement = bool(visual and diameter and visual["visual_prediction"] != diameter["diameter_grade"])
    segmentation = (diameter or {}).get("segmentation_model") or errors.get("diameter_diagnostics", {}).get("segmentation_model") or errors.get("diameter_diagnostics", {}).get("segmentation", {}).get("detection_info")
    comparison = {"legacy_detector": None if detector is None else {
        "quill_detected": detector["detected_quills"] > 0,
        "max_confidence": max(detector.get("confidences", []), default=None)},
        "segmentation_model": segmentation}
    reasons = []
    if detector is None:
        reasons.append("Detector check unavailable")
    elif detector["detected_quills"] == 0:
        reasons.append("V5 returned zero detections at confidence 0.25")
    if not visual:
        reasons.append(errors.get("visual", "Visual prediction missing"))
    if not diameter:
        reasons.append(errors.get("diameter", "Diameter measurement missing"))
    elif diameter["diameter_grade"] == "Manual review":
        reasons.append(f"Diameter {diameter.get('diameter_mm', diameter.get('quill_diameter_mm'))} mm maps to Manual review under existing grade rules")
    if errors.get("quill_missing"):
        reasons.append("Required Quill segmentation mask is missing")
    if errors and not reasons:
        reasons.append("Module errors present: " + ", ".join(errors))
    numeric = (diameter or {}).get("diameter_mm", (diameter or {}).get("quill_diameter_mm"))
    breakdown = {
        "quill_detector_pass": bool(detector and detector["detected_quills"] > 0),
        "quill_detector_confidence": max((detector or {}).get("confidences", []), default=None),
        "visual_feature_pass": bool(visual),
        "visual_feature_reason": errors.get("visual", "RF completed with validated finite features/probabilities" if visual else "No visual result"),
        "segmentation_pass": bool(diameter or (segmentation and segmentation.get("coin_detected") and segmentation.get("quill_mask_available") and segmentation.get("segmentation_available"))),
        "coin_detected": (segmentation or {}).get("coin_detected"),
        "quill_segmented": (segmentation or {}).get("quill_mask_available"),
        "diameter_measurement_valid": bool(isinstance(numeric, (int, float)) and np.isfinite(numeric) and numeric > 0),
        "diameter_grade": (diameter or {}).get("diameter_grade"),
        "sample_validation_pass": status == "VALID",
        "final_failure_reason": "; ".join(reasons) if status != "VALID" else None,
        "final_status": status,
    }
    logging.getLogger(__name__).info("Sample validation breakdown: %s", json.dumps(breakdown))
    return {"validation_breakdown": breakdown, "status": status,
            "debug_comparison": comparison,
            "final_grade": diameter["diameter_grade"] if status == "VALID" else None,
            "message": message, "visual_disagreement": disagreement,
            "diagnostics": {"detector": detector, "visual": visual, "diameter": diameter,
                            "errors": errors, "moisture": {"status": "not_supplied", "required": False}}}


def validate_sample(data, geometry, service, progress=None):
    emit = progress or (lambda step, state: None)
    detector = visual = diameter = None
    errors = {}
    emit("detector", "running")
    try:
        detector = detect_evidence(service, data)
    except Exception:
        logging.getLogger(__name__).exception("Sample detector check failed")
        errors["detector"] = "Detector unavailable"
    emit("detector", "unavailable" if detector is None else "passed" if detector["detected_quills"] > 0 else "failed")
    emit("visual", "running")
    try:
        visual = service.predict_visual(data)
    except NoUsableQuillsError as error:
        errors["visual"] = str(error)
    except Exception:
        logging.getLogger(__name__).exception("Sample visual check failed")
        errors["visual"] = "Visual prediction unavailable"
    emit("visual", "passed" if visual else "unavailable")
    emit("diameter", "running")
    try:
        diameter = process(data, geometry)
    except DiagnosticFailure as error:
        errors["diameter"] = str(error)
        errors["diameter_diagnostics"] = error.diagnostics
        # These are explicit missing-segmentation errors, not infrastructure failures.
        missing = error.diagnostics.get("segmentation", {}).get("missing_classes", [])
        if error.status_code == 422 and ("quill" in missing or "Quill mask" in str(error) or "Coin and Quill masks" in str(error)):
            errors["quill_missing"] = True
    except Exception:
        logging.getLogger(__name__).exception("Sample diameter check failed")
        errors["diameter"] = "Diameter validation unavailable"
    emit("diameter", "passed" if diameter else "failed" if "diameter_diagnostics" in errors else "unavailable")
    emit("decision", "running")
    result = decide(detector, visual, diameter, errors)
    emit("decision", "passed" if result["status"] == "VALID" else "failed")
    return result
