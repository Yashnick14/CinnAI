# Controlled offline experiments — 2026-10-25

Production remains unchanged. No route, model service, frontend, classifier, threshold, coin size or grading boundary was modified. Application code does not import these scripts.

## Run
From backend:
- .\.venv\Scripts\python.exe experiments/shadow_v5/detector_replay.py
- .\.venv\Scripts\python.exe experiments/shadow_v5/shadow_replay.py
- .\.venv\Scripts\python.exe experiments/shadow_v5/test_shadow_candidate.py

Shadow replay uses saved original images and original YOLO masks from audit-shadow. It reapplies the production largest-component/opening baseline. It reuses the unchanged saved coin scale, and calls the production central_widths function for both masks. No new segmentation inference or scale estimation is substituted.

## Shadow experiment
shadow_candidate.py compares the Lab a/b chroma of the central body, peripheral mask region and nearby outside background. A proposed cut needs a local chromatic edge, outside-like peripheral chroma, inside-like body chroma and spatial support across at least 60% of central rows. Competing similarly strong distant edges cause abstention. Search is restricted to the outer 30% on each side. Row shift MAD must be <= 0.035 of width. No darkness threshold, extra erosion, fixed subtraction or interpolation of unsupported cuts is used.
Constants are initial experimental hypotheses, not calibrated settings. The candidate only changes rows with supported cuts; this can leave jagged residual shadow islands. Do not deploy.

| Saved filename timestamp (UTC) | Baseline px | Candidate px | Baseline mm | Candidate mm |
|---|---:|---:|---:|---:|
| 20261025T135923182444Z |323|306|20.4515|19.3751|
| 20261025T140047293941Z |273|254|19.4791|18.1234|
| 20261025T140140994966Z |530|454|32.8713|28.1577|
| 20261025T140252137527Z |533|521|34.5777|33.7993|

The two broad-shadow examples are the last two rows. Visual inspection: the 530 px case largely moves toward the visible right quill edge, with unsupported shadow fragments remaining. The 533 px case retains its broad right shadow; the small width reduction is not evidence of successful shadow removal.
The two less-shadowed comparison images also shrink by 17 and 19 px (5.26% and 6.96%). They are not physically measured clean ground truth. This fails to establish clean-quill non-shrinkage. Do not claim those reductions are accuracy gains.
The user confirmed no matched manual diameters are available. All manual/error fields are null, MAE cannot be computed, and improvement is unproven.
Five synthetic tests pass: clean body unchanged; dark body unchanged; low-chroma abstention; empty mask; no expansion/body core retained. Synthetic checks do not establish real-world accuracy.

## Detector replay
All 23 historical zero-output captures were replayed independently at 0.25 and 0.05, same V5, imgsz=640, CPU, same OpenCV BGR decode and default IoU. All remain zero at 0.25.
At 0.05:
- 3 near-threshold captures: 0.195226, 0.195226, 0.171250.
- 3 very-low captures: 0.076613, 0.069749, 0.063753.
- 17 no predictions.
- 0 incorrect-object predictions among the six recovered outputs.
All six boxes visually correspond to quills. These are capture counts; repeated images exist.
Important correction to the previous audit: four of the 17 zero-output scenes contain no cinnamon (pen, thread spool, two laptop views). They are correct negatives. The remaining 13 show quills and remain missed at 0.05.
"Genuine zero prediction" here means no postprocessed detection at 0.05, NOT proof of zero neural score at every possible threshold.
visual_review.json records review of the labeled contact sheets. This is visual correspondence, not an independently annotated IoU/recall benchmark.

## Outputs
output/shadow.csv and shadow.json: per-image widths, diameters, null manual/error fields.
Per-image folders: raw.png, refined.png, experimental.png, overlay-crop.jpg (red baseline, green candidate), diagnostics.json with row evidence and accepted widths.
output/detector.csv and detector.json: production/probe counts, all boxes/confidences, scene review.
output/contact-1.jpg through contact-4.jpg: reviewed overview.
output/summary.json: settings, model SHA256, counts and unavailable MAE.

## Recommendation
No production algorithm or detector threshold change is supported yet. Obtain caliper readings for matched clean/shadow pairs and test the frozen candidate on a separate held-out set. The candidate misses one known broad shadow and changes less-shadowed controls, so it cannot be promoted. Lowering V5 to 0.05 recovers six captures but still misses 13 quill scenes; this selected zero-output cohort cannot establish the false-positive cost of a production change.
