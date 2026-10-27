# Controlled automatic diameter prototype

Run the existing FastAPI backend on `0.0.0.0:8000` and the frontend with `npm run go`.
Keep `EXPO_PUBLIC_API_URL` set to the laptop's LAN IP. No new native modules or development build are required.

The iPhone camera now always shows a coin square and a vertical quill rectangle. Use the Sri Lankan Rs.10 coin with nominal outer diameter 26.4 mm. Place one complete quill and the coin on a plain, matte, contrasting surface; keep away from guide borders and avoid shadows. Photograph straight down. The quill must be vertical.

Tap capture, review, then Analyse. The result retains the independent RF prediction and adds prototype diameter values and a diagnostic overlay, or a retake reason. No hybrid grade is calculated. Diameter measurement never calls YOLO and never modifies RF masks, features or models.

## Mapping and retained files

CameraView local layout defines normalized guides. The coin guide has equal pixel width and height. This installed Expo iOS processed-photo path crops to the preview aspect ratio. Capture keeps processing enabled and EXIF, saves photo dimensions, and rejects inconsistent aspect ratios. Backend applies EXIF orientation before validating dimensions and constructing ROIs. Normalized coordinates map directly to that upright, preview-cropped photo; there is no second aspect-fill crop.

Only iOS captures currently attach this verified-source mapping mode. Other platforms keep visual analysis but report diameter unavailable. Physical alignment on the actual iPhone must still be checked.

Phone: app documents `grading-images/<id>.jpg` and `<id>.geometry.json`.
Backend: `backend/data/temporary-visual-uploads/` (or configured temporary-upload directory), with original image, matching `.geometry.json`, and successful `.overlay.png`. Failed segmentation retains original and geometry. These are temporary debugging files with manual cleanup and no database integration.

## Separate API

`POST /measure-diameter`: multipart fields `image` (JPEG/PNG) and `capture_geometry` (JSON). Geometry version 1 includes mapping `ios-preview-cropped`, image_width/image_height, preview_width/preview_height and normalized coin/quill rectangles (`x`, `y`, `width`, `height`).

Success fields: coin_diameter_px, pixels_per_mm, quill_width_px, quill_diameter_mm, diameter_grade, valid_rows, diagnostic_overlay (PNG data URI). Bad/missing geometry or segmentation: HTTP 422 with retake guidance. Upload/storage limits use 413/415/507. Existing `/predict-visual` response stays unchanged.

Coin: Lab border-background separation, thresholding, outer contour quality checks, convex hull enclosing circle. Ellipse ratio rejects obvious tilt. Quill: separate Lab foreground segmentation and connected contour selection, central 40–60% length band, contiguous horizontal foreground rows, median/MAD rejection and stability checks. These quality thresholds are provisional and require real-image validation. No numeric fallback is returned on segmentation failure.

Diameter bins: below 7 Alba; [7,8) manual review; [8,10) C5 Special; [10,12) C5; [12,16) C4; [16,18) M5; [18,21) M4; [21,23) H1; [23,32] H2; above 32 manual review. Shared legacy grading rules remain untouched.

## Required real-device validation

1. Photograph a plain calibration target placed just inside each guide edge. Inspect the backend original and overlay: ROI edges must coincide with those physical target positions. Reject measurements if alignment differs.
2. Capture the same quill several times, keeping all boundaries visible and changing neither zoom nor camera angle during capture.
3. Compare median photographed width against a caliper measurement at the same central section. Record individual error and repeatability before accepting grading accuracy.
4. Test clipping, missing coin, tilted quill, poor lighting and textured backgrounds: these should request a retake rather than produce an accepted measurement.

Same supporting surface does not place the quill's visible surface at the coin plane. Camera distance, quill height, shadows and noncircular cross sections can bias projected width; this prototype does not perform 3D or perspective correction.

## Files changed for this module

Backend: app/main.py; new app/measurement/config.py, app/measurement/controlled.py, app/api/routes/diameter.py; tests/test_api.py; new tests/test_diameter.py.

Frontend: src/screens/CameraScreen.tsx, ImageReviewScreen.tsx, AnalysingScreen.tsx, ResultScreen.tsx; src/hooks/useDeviceCamera.ts; src/services/camera.ts; src/storage/photos.ts and photos.web.ts; src/types/visual.ts; new src/config/captureGuides.ts, src/types/diameter.ts, src/services/diameterApi.ts, tests/captureGuides.test.ts and tests/diameterApi.test.ts.

This document is also new. No model artifacts, visual inference modules, dependencies, database, moisture or hybrid logic were changed.

## Implementation checks

47 backend tests and 130 frontend tests passed; TypeScript and iOS export passed. The known synthetic fixture measured a 250.0002 px coin, 9.4697 px/mm scale and 150 px quill width, producing 15.83999 mm / C4. Tests also cover grade boundaries, missing/clipped objects, quill tilt, invalid geometry, multipart upload, cancellation and saved diagnostic artifacts. This verifies implementation behavior, not real-world measurement accuracy. No real guided iPhone capture has been validated yet.
