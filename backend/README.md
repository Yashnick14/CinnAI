# CinnAI backend

See the root README for the current architecture, endpoints and frontend startup.

From this directory (PowerShell):

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt -c constraints-tested.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Skip venv creation if it exists. Configure `.env` privately. No PostgreSQL process is required by the active routes.
Visual models load at startup; segmentation and assistant load lazily. Active artifacts and hashes are listed in `models/README.md`.
`MODEL_DIRECTORY` defaults to `backend/models` and expects the new filenames.

`/predict-visual` remains independent. `/measure-diameter` uses Coin/Quill segmentation and the existing 1.5 mm calibration.
`/validate-sample` gates the diameter grade and provides visual diagnostics; `?live=true` streams progress.
`/assistant/ask` retains its separate deterministic/retrieval workflow.
Original uploads and diagnostics retain their existing local storage behavior under `data/temporary-visual-uploads`;
evaluation collection remains in `backend_handoff/realworld_v5_collection`. These directories are not deployment assets.

## Authoritative preprocessing

`app/ml/visual/feature_extraction.py` copies the functions from one-based notebook
cells 91 and 92 verbatim. AST-equivalence tests guard against changes to formulas.
It does not use cell 122's later revisions.

- YOLO: image size 640, confidence 0.25, CPU; no explicit IoU override.
- All YOLO boxes are considered, without cell 141's area/aspect filter.
- Coordinates truncate to integers. Padding is 15% of box width/height on each side,
  clipped to image bounds by the original mask function.
- LAB background border uses the crop's minimum dimension; contour scoring uses
  the original detection centre relative to the padded crop.
- Original foreground erosion and saturation-weighted circular hue formula.
- Original surface formulas, including the **7x7 Gaussian blur** for local contrast.
- Circular mean across quill hue values, arithmetic means for the other features.
  Original aggregation computes standard deviations/variation too, but the same
  final selection excludes them, leaving exactly the saved 21 features in order.
- Missing/empty masks and `None` feature results are skipped as in cell 92.
  Crop-specific OpenCV/value errors are also skipped, as requested, without
  replacing features. No usable quill feature sets yields HTTP 422.
- `detected_quills` counts all returned YOLO boxes, as training did. It can include
  false positives or overlapping detections; it is not a verified physical count.
  Only usable feature sets enter aggregation.

RF probabilities map to the validated estimator class order. Confidence is the
largest raw RF probability, not a calibrated accuracy score. No additional grade
thresholds, probability renormalization, or hybrid decisions are applied.


## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

`constraints-tested.txt` records the local dependency environment. Notebook feature-parity tests retain their original fixtures.
`verify_visual.py` is a historical notebook comparison utility; its original detector-era outcomes are not V5 acceptance targets.
Current refactor test evidence is summarized in `../docs/refactor-report.md`.
