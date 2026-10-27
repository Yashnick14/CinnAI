"""Controlled-capture configuration; independent of visual RF inference."""
COIN_DIAMETER_MM = 26.4
GUIDE_VERSION = 1

# Active FYP prototype calibration, in MILLIMETRES.
# Preliminary empirical offset from six manually measured quills:
# MAE 2.167 -> 1.000 mm; MAPE 11.53 -> 5.09%.
# Not universally validated; requires a larger independent validation set.
USE_DIAMETER_CALIBRATION = True
DIAMETER_CALIBRATION_OFFSET_MM = 1.5


def diameter_calibration(raw_diameter_mm: float) -> dict:
    calibrated = max(raw_diameter_mm - DIAMETER_CALIBRATION_OFFSET_MM, 0.0)
    return {
        "raw_diameter_mm": raw_diameter_mm,
        "calibrated_diameter_mm": calibrated,
        "calibration_enabled": USE_DIAMETER_CALIBRATION,
        "calibration_experimental": False,
        "calibration_status": "preliminary_empirical_fyp",
        "calibration_offset_mm": DIAMETER_CALIBRATION_OFFSET_MM,
        "grading_diameter_mm": calibrated if USE_DIAMETER_CALIBRATION else raw_diameter_mm,
    }


def diameter_grade(mm: float) -> str:
    if mm < 7.0:
        return "Alba"
    if 7.0 <= mm < 10.0:
        return "C5 Special"
    # Compare the unrounded measurement exactly: no tolerance or rounding.
    # Keep the existing API label for MANUAL REVIEW so the frontend accepts it.
    if mm in (10.0, 12.0, 16.0, 18.0, 21.0, 25.0):
        return "Manual review"
    for lower, upper, grade in (
        (10.0, 12.0, "C5"),
        (12.0, 16.0, "C4"),
        (16.0, 18.0, "M5"),
        (18.0, 21.0, "M4"),
        (21.0, 25.0, "H1"),
    ):
        if lower < mm < upper:
            return grade
    return "H2" if 25.0 < mm <= 32.0 else "Manual review"
