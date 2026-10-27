# Temporary coin diagnostics

Restart FastAPI, then take one more guided photo and tap Analyse. No frontend restart or native build is needed for these backend-only diagnostics.

Look in `backend/data/temporary-visual-uploads/` (or TEMP_VISUAL_UPLOAD_DIRECTORY if overridden). The terminal prints the full `.coin-diagnostics.json` path for each processed request. Files sharing the timestamp/UUID belong to the same request:

- Original JPEG/PNG and `.geometry.json`: original input and supplied geometry.
- `.coin-roi.png`: exact upright-image pixel crop passed to coin segmentation.
- `.mapped-guides.png`: full upright image showing the mapped coin ROI. On mapping failure this is tentative and explicitly unsafe in the report.
- `.coin-mask.png`: exact closed foreground mask used for contour finding, if foreground separation succeeded.
- `.coin-contours.png`: all external candidate contours, IDs, and diagnostic enclosing circles. Red means rejected; green means passed the existing tests; blue means diagnostic circle. If contour extraction was not reached, this is the unannotated ROI.
- `.coin-selected.png`: uniquely selected contour and circle, only when selection succeeds.
- `.coin-diagnostics.json`: coordinates, mapping status, failure stage/categories, foreground statistics, all contour metrics/reasons, selected contour/circle, and artifact paths.

Each candidate includes area, bounding box and centroid in ROI pixels, distance to ROI centre, convexity, solidity, border contact, existing border-margin violation, circle radius/centre, circularity, ellipse ratio and circle fill ratio. Right/bottom crop bounds are exclusive. Accepted candidates can still be ambiguous collectively; see accepted_candidate_ids and selection_rejection_reason.

The existing thresholds and grade rules are unchanged. Circle diameter relative to guide size and circle overflow are diagnostic only: the existing algorithm has no independent expected-circle-size rejection threshold. This instrumentation does not add one.

Success responses include `coin_diagnostics`. Measurement/geometry failures retain HTTP 422 with the existing string `detail` and add `coin_diagnostics`. Current frontend continues to show that error; diagnostics are saved for inspection on the laptop. Files are retained on failed measurement too. Invalid geometry cannot yield a trustworthy ROI; malformed/unsupported/oversized image uploads cannot yield image diagnostics and retain existing upload validation errors.

Dimension/aspect checks cannot prove physical ROI alignment. Inspect `.coin-roi.png` and `.mapped-guides.png` before attributing failure to segmentation. No RF inference changes were made.
