"""Lazy, independent Coin/Quill segmentation for diameter measurement only."""
from dataclasses import dataclass
from pathlib import Path
from threading import Lock

import cv2
import numpy as np

from app.core.config import MODEL_DIRECTORY, SEGMENTATION_MODEL_NAME


class SegmentationUnavailableError(RuntimeError):
    """Missing/incompatible checkpoint or inference failure; diameter returns 503."""


class SegmentationDetectionError(ValueError):
    """No usable Coin or Quill detection; diameter returns 422."""

    def __init__(self, message, evidence=None):
        super().__init__(message)
        self.evidence = evidence or {}


@dataclass(frozen=True)
class SegmentationPrediction:
    coin_mask: np.ndarray
    quill_mask: np.ndarray
    coin_confidence: float
    quill_confidence: float
    detection_info: dict | None = None


class SegmentationModelService:
    def __init__(self, model):
        names = model.names
        entries = names.items() if isinstance(names, dict) else enumerate(names)
        self.class_names = {int(key): str(value).strip().casefold() for key, value in entries}
        if getattr(model, "task", None) != "segment" or sorted(self.class_names.values()) != ["coin", "quill"]:
            raise SegmentationUnavailableError("Diameter checkpoint must be a segmentation model with Coin and Quill classes.")
        self.model = model
        self._prediction_lock = Lock()

    @classmethod
    def load(cls, directory: Path = MODEL_DIRECTORY):
        path = directory / SEGMENTATION_MODEL_NAME
        # Check before calling YOLO so a missing file cannot trigger a download.
        if not path.is_file():
            raise SegmentationUnavailableError(f"Diameter segmentation model is missing. Copy {SEGMENTATION_MODEL_NAME} to {directory.resolve()}.")
        try:
            from ultralytics import YOLO
            return cls(YOLO(str(path)))
        except SegmentationUnavailableError:
            raise
        except Exception as error:
            raise SegmentationUnavailableError("Could not load the diameter segmentation checkpoint. Check its format and Ultralytics compatibility.") from error

    def predict(self, image: np.ndarray) -> SegmentationPrediction:
        debug = None
        try:
            with self._prediction_lock:
                results = self.model.predict(source=image, imgsz=640, conf=0.25,
                                             retina_masks=True, device="cpu", verbose=False)
                debug = {"coin_detected": False, "coin_confidence": None,
                         "quill_detected": False, "quill_confidence": None,
                         "coin_detection_count": 0, "quill_detection_count": 0,
                         "segmentation_available": False, "quill_mask_available": False}
                if results and results[0].boxes is not None:
                    for class_id, score in zip(results[0].boxes.cls.cpu().numpy().reshape(-1), results[0].boxes.conf.cpu().numpy().reshape(-1)):
                        name = self.class_names.get(int(class_id)) if np.isfinite(class_id) else None
                        if name in ("coin", "quill") and np.isfinite(score) and .25 <= score <= 1:
                            debug[f"{name}_detected"] = True
                            debug[f"{name}_detection_count"] += 1
                            debug[f"{name}_confidence"] = max(debug[f"{name}_confidence"] or 0, float(score))
                    if results[0].masks is not None:
                        raw_masks = results[0].masks.data.cpu().numpy()
                        debug["segmentation_available"] = bool(raw_masks.size and np.isfinite(raw_masks).all() and np.any(raw_masks > .5))
                        for index, (class_id, score) in enumerate(zip(results[0].boxes.cls.cpu().numpy().reshape(-1), results[0].boxes.conf.cpu().numpy().reshape(-1))):
                            if np.isfinite(class_id) and self.class_names.get(int(class_id)) == "quill" and .25 <= score <= 1 and index < len(raw_masks):
                                debug["quill_mask_available"] |= bool(np.isfinite(raw_masks[index]).all() and np.any(raw_masks[index] > .5))
                if not results or results[0].boxes is None or results[0].masks is None:
                    raise SegmentationDetectionError("Coin and Quill masks were not detected.", {"missing_classes": ["coin", "quill"]})
                result = results[0]
                classes = result.boxes.cls.cpu().numpy().reshape(-1)
                scores = result.boxes.conf.cpu().numpy().reshape(-1)
                masks = result.masks.data.cpu().numpy()
                if masks.ndim != 3 or len(classes) != len(scores) or len(scores) != len(masks):
                    raise SegmentationUnavailableError("Diameter model returned incompatible boxes and masks.")
                selected = {}
                for index, (class_id, score) in enumerate(zip(classes, scores)):
                    if not np.isfinite(class_id) or not np.isfinite(score) or not 0 <= score <= 1:
                        raise SegmentationUnavailableError("Diameter model returned invalid class/confidence values.")
                    name = self.class_names.get(int(class_id))
                    if name not in ("coin", "quill") or score < .25:
                        continue
                    if name not in selected or score > selected[name][0]:
                        selected[name] = (float(score), index)
                for name in ("coin", "quill"):
                    if name not in selected:
                        raise SegmentationDetectionError(f"No {name.title()} mask detected at confidence 0.25.",
                            {"missing_classes": [key for key in ("coin", "quill") if key not in selected],
                             "confidences": {key: value[0] for key, value in selected.items()}})
                chosen = {}
                for name, (score, index) in selected.items():
                    mask = masks[index]
                    if not np.isfinite(mask).all():
                        raise SegmentationUnavailableError("Diameter model returned non-finite mask values.")
                    # Ultralytics instance masks are binary; copy out of shared predictor state.
                    chosen[name] = (mask > .5).astype(np.uint8)
                    if chosen[name].shape != image.shape[:2]:
                        chosen[name] = cv2.resize(
                            chosen[name], (image.shape[1], image.shape[0]),
                            interpolation=cv2.INTER_NEAREST,
                        )
                    if not np.any(chosen[name]):
                        raise SegmentationDetectionError(f"The highest-confidence {name.title()} mask is empty.",
                            {"missing_classes": [name], "confidences": {key: value[0] for key, value in selected.items()}})
                return SegmentationPrediction(chosen["coin"], chosen["quill"],
                                              selected["coin"][0], selected["quill"][0], debug)
        except SegmentationDetectionError as error:
            error.evidence["detection_info"] = debug
            raise
        except SegmentationUnavailableError:
            raise
        except Exception as error:
            raise SegmentationUnavailableError("Diameter segmentation inference failed. Check backend logs and checkpoint compatibility.") from error


_service = None
_load_lock = Lock()


def get_segmentation_service() -> SegmentationModelService:
    global _service
    with _load_lock:
        if _service is None:
            # Cache only successful loads; copying a missing model allows the next request to retry.
            _service = SegmentationModelService.load()
        return _service
