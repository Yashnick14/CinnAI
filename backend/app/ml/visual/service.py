"""Visual-only YOLO/RF inference using the authoritative training pipeline."""
from pathlib import Path
from threading import Lock

import cv2
import joblib
import numpy as np
import pandas as pd

from app.core.config import MODEL_DIRECTORY, RF_MODEL_NAME, SUPPORTED_GRADES, YOLO_MODEL_NAME
from app.ml.visual import feature_extraction as features

FEATURE_COLUMNS = (
    "hue_circular_mean", "sat_mean_mean", "value_mean_mean", "hue_median_mean",
    "sat_median_mean", "value_median_mean", "lab_l_mean_mean", "lab_a_mean_mean",
    "lab_b_mean_mean", "lab_l_median_mean", "lab_a_median_mean", "lab_b_median_mean",
    "foreground_ratio_mean", "intensity_mean_mean", "intensity_std_mean",
    "intensity_median_mean", "edge_density_mean", "local_contrast_mean",
    "dark_anomaly_ratio_mean", "surface_entropy_mean", "laplacian_variance_mean",
)

class NoUsableQuillsError(ValueError):
    """No usable foreground feature sets survived extraction."""

class InvalidImageError(ValueError):
    pass

class ModelContractError(RuntimeError):
    pass

class VisualModelService:
    def __init__(self, detector, rf_bundle):
        self.detector = detector
        self.rf_model = rf_bundle["model"]
        self.feature_columns = list(rf_bundle["features"])
        self.classes = list(rf_bundle["classes"])
        if self.feature_columns != list(FEATURE_COLUMNS):
            raise ModelContractError("RF feature list/order does not match the 21 training features.")
        if self.classes != list(SUPPORTED_GRADES) or list(self.rf_model.classes_) != self.classes:
            raise ModelContractError("RF class order does not match the eight supplied grades.")
        if self.rf_model.n_features_in_ != 21 or list(self.rf_model.feature_names_in_) != self.feature_columns:
            raise ModelContractError("Estimator feature metadata does not match its saved feature list.")
        names = self.detector.names
        if names != {0: "Quill"}:
            raise ModelContractError("Expected the supplied one-class Quill detector.")
        self._lock = Lock()

    @classmethod
    def load(cls, directory: Path = MODEL_DIRECTORY):
        # Fail before YOLO can auto-download an unrelated model.
        for name in (YOLO_MODEL_NAME, RF_MODEL_NAME):
            if not (directory / name).is_file():
                raise FileNotFoundError(f"Required model file is missing: {directory / name}")
        from ultralytics import YOLO
        detector = YOLO(str(directory / YOLO_MODEL_NAME))
        bundle = joblib.load(directory / RF_MODEL_NAME)
        return cls(detector, bundle)

    def extract_image_features(self, image):
        # Cell 92: all returned boxes, no area/aspect filter, no IoU override.
        results = self.detector.predict(
            source=image, imgsz=640, conf=0.25, device="cpu", verbose=False,
        )
        boxes = results[0].boxes
        detected_count = 0 if boxes is None else len(boxes)
        if detected_count == 0:
            raise NoUsableQuillsError("No quill detected in the uploaded image.")
        per_quill = []
        for box in boxes:
            coords = box.xyxy[0].cpu().numpy().astype(int)
            try:
                crop, mask = features.create_quill_mask_v2(image, coords)
                if crop is None or mask is None or np.count_nonzero(mask) == 0:
                    continue
                colour = features.extract_colour_features(crop, mask)
                surface = features.extract_surface_features(crop, mask)
                if colour is None or surface is None:
                    continue
                per_quill.append({**colour, **surface})
            except (cv2.error, ValueError, FloatingPointError):
                # A malformed individual crop must not discard other usable quills.
                continue
        if not per_quill:
            raise NoUsableQuillsError("Quills were detected, but no usable foreground feature sets remained.")
        # Cell 92 computes circular hue and means/stds. Cells 93–94 retain only
        # the exact 21 columns below (no count, confidence, std or hue variation).
        aggregated = features.aggregate_quill_features(per_quill)
        row = {name: aggregated[name] for name in self.feature_columns}
        if not np.isfinite(list(row.values())).all():
            raise ModelContractError("Feature extraction produced non-finite values.")
        return detected_count, len(per_quill), row

    def predict_visual(self, data: bytes):
        # OpenCV BGR decoding matches training's cv2.imread colour convention.
        image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise InvalidImageError("The uploaded image could not be decoded.")
        # Ultralytics predictor instances are shared; serialize inference access.
        with self._lock:
            detected, _usable, row = self.extract_image_features(image)
            frame = pd.DataFrame([row], columns=self.feature_columns)
            probabilities = np.asarray(self.rf_model.predict_proba(frame)[0], dtype=float)
        if probabilities.shape != (8,) or not np.isfinite(probabilities).all() or (probabilities < 0).any() or (probabilities > 1).any() or not np.isclose(probabilities.sum(), 1.0):
            raise ModelContractError("The RF returned invalid probabilities.")
        probability_dict = {str(grade): float(prob) for grade, prob in zip(self.classes, probabilities)}
        prediction = max(probability_dict, key=probability_dict.get)
        return {
            "detected_quills": detected,
            "visual_prediction": prediction,
            "visual_confidence": probability_dict[prediction],
            "probabilities": probability_dict,
        }
