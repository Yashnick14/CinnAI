# Docker validation — 28 October 2026

**Final infrastructure/parity status: PASS.** Detection accuracy on these three historical fixtures remains unsatisfactory on both operating systems; this is not a Linux regression.

## Verified results

- Linux: 172 tests passed in 6.82 seconds. Windows regression: 172 passed.
- PowerShell 5.1 helper test passed: normal stderr accepted; nonzero exit 7 still throws.
- Image-reported size: 801,701,429 bytes (764.56 MiB), not registry transfer size or total Docker disk usage.
- V5, Coin/Quill segmentation, RF and MiniLM loaded in Linux. Query embedding is 384-dimensional; saved matrix is 62 x 384.
- FastAPI lifespan startup: 0.602 s (excludes imports and image pull). Container health reached after 6.523 s including probe scheduling.
- MiniLM initialization: 0.256 s.
- Idle container: 327.5 MiB, sampled 0.15% CPU.
- Peak process RSS: 954.664 MiB. Cgroup peak: 859,598,848 bytes. Different accounting metrics, not additive.
- Tested with 2 CPU / 4 GiB, sequential requests. This is not a concurrency benchmark.

## Exact Windows/Linux comparison

All model hashes, original image hashes, decoded BGR image hashes, shapes, boxes, confidences and resolved IoU match. Settings: imgsz=640, conf=0.25, CPU, IoU=0.7. Original image decoding/preprocessing unchanged.

| Image | Windows/Linux V5 detections | Raw mm | Calibrated/displayed mm | Diameter grade |
|---|---:|---:|---:|---|
| diameter_test_01.jpg | 0 / 0 | 30.857755 | 29.357755 | H2 |
| diameter_test_02.jpg | 0 / 0 | 22.793277 | 21.293277 | H1 |
| diameter_test_03.jpg | 0 / 0 | 20.128395 | 18.628395 | M4 |

All diameter endpoints returned 200. All visual endpoints returned 422/no quill. All validation endpoints returned 200/INVALID. Each substantive response field matches exactly across platforms. Diameter grades above are measurement evidence, not an allowed final grade for INVALID samples.

The raw measurement is retained in the API. The displayed/calibrated value is max(raw-1.5,0), checked in the smoke test. No boundary changes. RF initializes, but successful RF inference through these photos is not demonstrated because V5 rejects them. Existing tests verify RF response contracts.

Conclusion: existing V5/setup limitations on these inputs, not a demonstrated OS discrepancy. No lower-threshold experiment was run, so this cannot determine whether predictions exist below 0.25.

## Verified model SHA256

- `quill_detector_v5.pt`: `78a09c742380691bbc53a60e866656aa3b529a171f5aad459125d7adf4c80f1f`
- `coin_quill_segmentation.pt`: `4ce2b6106517a7b8168a507fe50aad3c74a576e1546f534eb18544cae06ad9f9`
- `rf_vision_8_class.pkl`: `7f87c62c025d332965c20d2f0075673471810dd5fef9a4c37efd7c2558d9f245`

## Changes in this follow-up

- validate.ps1: function-scoped native stderr handling, explicit exit-code checks, log/inspect/cleanup use the wrapper, cleanup attempted even if logs fail, final status marker.
- test-native-output.ps1: real native stderr/exit-code regression test of the exact wrapper.
- smoke.py: same replay on Windows/Linux, checksums, decoded-pixel hashes, raw boxes, actual IoU and raw/calibrated response fields.
- validation-comparison.json: exact clean comparison evidence.
- VALIDATION.md: this report.

## Commands from project root

```powershell
docker build --platform linux/amd64 --target production -t cinnai-backend:local ./backend
powershell.exe -ExecutionPolicy Bypass -File .\backend\docker\validate.ps1
docker run --name cinnai-backend --init -p 8000:8000 --cpus 2 --memory 4g --read-only --tmpfs /tmp:rw,nosuid,size=1g,mode=1777 --mount type=volume,source=cinnai-data,target=/var/lib/cinnai --env-file ./backend/.env cinnai-backend:local
```

Use a private container-specific environment file if the local .env contains Windows path overrides. Docker defaults direct uploads/evaluation captures to /var/lib/cinnai. GEMINI_API_KEY and CORS configuration are runtime-only. Live Gemini generation is not covered by this offline validation.

## Before Terraform

Start further sizing tests at 2 vCPU / 4 GiB; this is not a measured minimum. Keep one worker/replica initially: evaluation CSV writes use process-local locking. Persistent capture storage and retention are needed; ephemeral storage loses files on replacement. Baked MiniLM assets do not need persistent storage.
Provision ignored models with checksum verification in CI. The notebook test fixture is local/private and not baked into the image. Review backend authentication before public exposure. Test concurrency and storage growth; lock Linux dependencies and base-image digest before reproducible release.

All changes remain on Development. No frontend, model, threshold, grading, calibration or Azure changes. No push/merge.
Evidence: user-executed Docker report C:/Users/Yashnick/AppData/Local/Temp/cinnai-docker-20261028-101039; inspected directly. Windows replay: sibling docker-windows-comparison/windows.json. Agent sandbox still cannot access Docker's engine pipe.
