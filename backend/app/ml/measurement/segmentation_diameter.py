"""Full-image YOLO mask measurement, independent of the legacy Lab implementation."""
import base64
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageOps

from app.ml.measurement import config
from app.ml.segmentation.service import get_segmentation_service


def original_size_mask(mask, width, height):
    mask = np.asarray(mask)
    if mask.ndim != 2 or not mask.size or not np.isfinite(mask).all():
        raise ValueError("Invalid diameter segmentation mask.")
    mask = (mask > .5).astype(np.uint8)
    if mask.shape != (height, width):
        mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_NEAREST)
    return mask


def refine_quill_mask(mask):
    """Remove detached noise and thin protrusions without a width offset."""
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count <= 1:
        raise ValueError("Quill mask contains no foreground pixels.")
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    component = (labels == largest).astype(np.uint8)
    refined = cv2.morphologyEx(
        component, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1
    )
    # Opening can disconnect a thin appendage; retain only the main quill.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(refined, connectivity=8)
    if count <= 1:
        raise ValueError("No valid Quill mask remains after light cleanup.")
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return (labels == largest).astype(np.uint8)


def central_widths(mask):
    ys, _ = np.nonzero(mask)
    if not len(ys):
        raise ValueError("Quill mask contains no foreground pixels.")
    y_min, y_max = int(ys.min()), int(ys.max())
    # Explicit integer convention: height=max-min; floor endpoints; end-exclusive.
    height = y_max - y_min
    band_start = int(y_min + .30 * height)
    band_end = int(y_min + .70 * height)
    rows = []
    for y in range(band_start, band_end):
        xs = np.flatnonzero(mask[y])
        if len(xs):
            rows.append((y, int(xs.min()), int(xs.max()), int(xs.max()-xs.min()+1)))
    if not rows:
        raise ValueError("No valid Quill widths in the central 40% band.")
    widths = np.asarray([row[3] for row in rows], dtype=float)
    median = float(np.median(widths))
    mad = float(np.median(np.abs(widths-median)))
    keep = np.abs(widths-median) <= 2.5*mad if mad > 0 else np.ones(len(widths), dtype=bool)
    if not np.any(keep):
        raise ValueError("No Quill widths remain after MAD filtering.")
    return rows, keep, float(np.median(widths[keep])), mad, (band_start, band_end)


def measure(data: bytes, geometry, diagnostics=None, service=None):
    if diagnostics is None:
        diagnostics = {"report": {}, "images": {}}
    report = diagnostics["report"]
    report.update(stage="segmentation_image_decode", engine="yolo11_segmentation",
                  mapping_status="full_image_masks_guides_retained_as_metadata_only")
    with Image.open(BytesIO(data)) as source:
        image = cv2.cvtColor(np.asarray(ImageOps.exif_transpose(source).convert("RGB")), cv2.COLOR_RGB2BGR)
    height, width = image.shape[:2]
    report["upright_image_dimensions_px"] = {"width": width, "height": height}
    report["stage"] = "segmentation_prediction"
    prediction = (service or get_segmentation_service()).predict(image)
    report["segmentation_model"] = prediction.detection_info
    coin = original_size_mask(prediction.coin_mask, width, height)
    quill = original_size_mask(prediction.quill_mask, width, height)
    diagnostics["images"].update({"coin-mask": coin*255, "quill-mask": quill*255})
    ys, xs = np.nonzero(quill)
    if len(xs):
        left, top = max(0, int(xs.min())-20), max(0, int(ys.min())-20)
        right, bottom = min(width, int(xs.max())+21), min(height, int(ys.max())+21)
        diagnostics["images"]["quill-crop"] = image[top:bottom, left:right].copy()
        report["quill_crop_image_px"] = dict(left=left, top=top, right=right, bottom=bottom)
    report["shadow_assessment"] = "Not automatically classified: broad connected shadows may survive opening; inspect original/crop and mask edges."

    report["stage"] = "segmentation_coin_measurement"
    contours, _ = cv2.findContours(coin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise ValueError("Coin mask contains no external contour.")
    contour = max(contours, key=cv2.contourArea)
    center, radius = cv2.minEnclosingCircle(contour)
    if cv2.contourArea(contour) <= 0 or radius <= 0 or not np.isfinite(radius):
        raise ValueError("Coin mask has no measurable area.")
    coin_diameter_px = float(2*radius)
    pixels_per_mm = coin_diameter_px / config.COIN_DIAMETER_MM
    report["stage"] = "segmentation_quill_refinement"
    original_quill = quill
    quill = refine_quill_mask(original_quill)
    diagnostics["images"]["quill-mask-refined"] = quill * 255
    report["quill_refinement"] = {
        "method": "largest_component_open_largest_component",
        "kernel_size_px": 3, "opening_iterations": 1, "extra_erosion_iterations": 0,
        "original_foreground_pixels": int(original_quill.sum()),
        "refined_foreground_pixels": int(quill.sum()),
    }
    report["stage"] = "segmentation_quill_measurement"
    rows, keep, quill_width_px, mad, band = central_widths(quill)
    raw_diameter_mm = quill_width_px / pixels_per_mm
    calibration = config.diameter_calibration(raw_diameter_mm)
    # Existing aliases represent the diameter used for grading/display; raw is preserved.
    diameter_mm = calibration["grading_diameter_mm"]
    result = dict(diameter_mm=diameter_mm, quill_diameter_mm=diameter_mm,
                  diameter_grade=config.diameter_grade(diameter_mm),
                  coin_confidence=prediction.coin_confidence, quill_confidence=prediction.quill_confidence,
                  coin_diameter_px=coin_diameter_px, quill_width_px=quill_width_px,
                  pixels_per_mm=pixels_per_mm, raw_valid_rows=len(rows),
                  filtered_rows=int(keep.sum()), valid_rows=int(keep.sum()))
    result.update(calibration)
    report.update(result)
    result["segmentation_model"] = prediction.detection_info
    report.update(band_start=band[0], band_end_exclusive=band[1], width_mad_px=mad,
                  selected_enclosing_circle={"center_image_px":list(center), "radius_px":float(radius)})
    report["measurement_rows"] = [
        {"y": y, "left": left, "right": right, "width_px": w, "accepted": bool(accepted)}
        for (y, left, right, w), accepted in zip(rows, keep)
    ]
    overlay = image.copy()
    original_contours, _ = cv2.findContours(original_quill, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, original_contours, -1, (0,165,255), 1)
    cv2.drawContours(overlay, [contour], -1, (0,255,0), 2)
    cv2.circle(overlay, tuple(round(v) for v in center), round(radius), (0,255,255), 2)
    quill_contours, _ = cv2.findContours(quill, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, quill_contours, -1, (255,255,0), 2)
    xs = np.flatnonzero(np.any(quill, axis=0))
    cv2.rectangle(overlay, (int(xs.min()),band[0]), (int(xs.max()),band[1]), (255,0,255), 2)
    for index, ((y,left,right,_), accepted) in enumerate(zip(rows, keep)):
        if index % max(1,len(rows)//16) == 0:
            cv2.line(overlay, (left,y), (right,y), (0,255,0) if accepted else (0,0,255), 1)
    cv2.putText(overlay, f"{diameter_mm:.2f} mm | raw {raw_diameter_mm:.2f} mm | " + ("preliminary calibrated" if config.USE_DIAMETER_CALIBRATION else "uncalibrated"), (20,40), cv2.FONT_HERSHEY_SIMPLEX,.8,(0,0,255),2)
    diagnostics["images"]["quill-measurement-rows"] = overlay.copy()
    ok, encoded = cv2.imencode(".png", overlay)
    if not ok:
        raise ValueError("Could not encode diameter overlay.")
    result["diagnostic_overlay"] = "data:image/png;base64," + base64.b64encode(encoded).decode()
    report["stage"] = "complete"
    return result, encoded.tobytes()
