# Active FYP prototype diameter calibration

The active segmentation measurement applies:
calibrated_diameter_mm = max(raw_diameter_mm - DIAMETER_CALIBRATION_OFFSET_MM, 0)

app/measurement/config.py sets USE_DIAMETER_CALIBRATION = True and DIAMETER_CALIBRATION_OFFSET_MM = 1.5 (MILLIMETRES).
The unchanged raw measurement is quill_width_px / pixels_per_mm, using the unchanged 26.4 mm coin reference.
segmentation_diameter.measure calls diameter_calibration once. diameter_mm and quill_diameter_mm expose the selected grading value; diameter_grade receives that value. raw_diameter_mm and calibrated_diameter_mm remain in API results and diagnostic reports.
The final decision service continues to copy diameter_grade only for VALID samples.
The frontend displays/saves quill_diameter_mm and does not subtract an offset. Its schema retains optional raw/calibrated fields and permits zero from the specified clamp.
Set USE_DIAMETER_CALIBRATION = False to restore raw grading/display while retaining the calculated comparison field.

Basis: six user-supplied manually measured quills; MAE 2.167 -> 1.000 mm; MAPE 11.53% -> 5.09%.
This is a preliminary empirical calibration for this FYP prototype, not a universally validated correction. A larger independent set is required. On the six samples, exact grade/manual-review agreement changed from 4/6 to 3/6 despite numerical error reduction. Exact boundary values still require manual review under unchanged policy.
Historical saved results are not retroactively recalculated.
The legacy OpenCV comparison implementation remains unchanged; the active segmentation endpoint uses this calibration.
