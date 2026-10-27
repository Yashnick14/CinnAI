# Segmentation diameter measurement

Copy `FINAL_QUILL_COIN_SEGMENTATION_YOLO11N.pt` into `backend/backend_handoff/`, alongside the existing detector and RF artifacts. `MODEL_DIRECTORY` may override this directory. `SEGMENTATION_MODEL_NAME` is separate from `YOLO_MODEL_NAME`.

The checkpoint loads on the first diameter request, not at application startup. It must be an Ultralytics segmentation checkpoint with Coin and Quill class names. Missing/incompatible models return HTTP 503; missing detections return HTTP 422. Failed loads are not cached, so a later request retries after the file is copied.

`POST /measure-diameter` still accepts multipart `image` and `capture_geometry`. Existing upload validation, original image retention and geometry sidecars remain. Guide geometry remains validated metadata; the new measurement uses full-image masks rather than guide crops. EXIF orientation is applied before inference.

Prediction uses `imgsz=640`, `conf=0.25`, `retina_masks=True` on CPU. The highest-confidence instance of each named class is selected. Masks are resized with nearest-neighbour interpolation if needed. Coin scale uses the largest external contour's minimum enclosing circle and the existing 26.4 mm reference.

Quill widths use inclusive horizontal spans in the central 30–70% of its mask height. Integer convention: height is `y_max-y_min`, band endpoints are truncated to integers, and the end is exclusive. Widths farther than 2.5 MAD from the median are excluded only when MAD is positive. The median remaining width is divided by pixels per mm. Grading calls the existing `diameter_grade()` unchanged.

Responses include `diameter_mm`, `diameter_grade`, `coin_confidence`, `quill_confidence`, `coin_diameter_px`, `quill_width_px`, `pixels_per_mm`, `raw_valid_rows` and `filtered_rows`. Compatibility aliases `quill_diameter_mm` and `valid_rows` remain, as do `diagnostic_overlay` and `coin_diagnostics`. The overlay shows masks, coin circle, central band and sampled accepted/rejected rows. Original images, geometry, masks, overlay and diagnostic JSON use the existing temporary upload folder and retention policy.

The legacy implementation remains in `app/measurement/controlled.py`. For Python comparisons, call it directly or pass its `measure` function to `app.api.routes.diameter.process(..., measurement=legacy_measure)`. The existing refinement validation script explicitly selects this legacy path. There is no public HTTP algorithm switch.

Tests use synthetic masks and fake detector output; they do not establish real checkpoint accuracy. After copying the checkpoint, restart the backend if replacing an already loaded model and submit real captures. Neither the visual pipeline nor frontend is changed.
