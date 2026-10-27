# Foundation validation

## Automated checks

Frontend: npm run typecheck, npm test, npm run export:ios.
Backend: python -m pytest -q (from backend with development dependencies installed).

Tests cover response validation/mapping, eight-grade restrictions, explicit mock labels,
missing moisture, 14% compliance boundary, review/failure fixtures, sensor cancellation,
freshness, reconnect, concurrent history saves, persistent image handoff and corrupt-history preservation.
Backend tests cover health, multipart input, unsupported/corrupt/oversized uploads, numeric bounds,
unique IDs and scenario contracts. Scientific model performance is not being tested.

## iPhone acceptance checklist (requires EAS build and device)

1. Open development build → intro → dashboard. Confirm DEMO banner.
2. New Grading → preparation → standard sample → camera permission.
3. Capture cinnamon and coin → review the real image → retake → capture again.
4. Analyse → explicit demo notice → M4 result, 23 mm fixture, fixed 11.8% demo moisture, PASS and GRADE ACCEPTED.
6. Expand Technical Details; inspect all eight probabilities and compatible candidates.
7. Save Result twice; one record should exist. Open it from History.
8. Force-close and reopen; saved image, result and timestamp remain.
9. Background and reopen the app on Camera; confirm the camera preview restarts.
10. Run moisture failure, conflict, measurement error and no-quill demo scenarios.
11. Simulate connection loss/timeout and reconnect. Confirm stale readings are not submitted.
12. Deny camera permission; verify clear permission/settings recovery.
13. Confirm no microphone, photo-library, Bluetooth or location permission is requested.
14. Test on a small iPhone display and with larger text. Verify scrollable content and usable buttons.
15. In API mode, submit a capture and verify `/api/v1/records` contains its UUID.
16. Restart the backend and PostgreSQL container; verify the record and image still load.

Native camera, real Bluetooth, EAS signing/build and physical hardware remain device checks.
The native BLE adapter and scientific pipeline have not yet been implemented.

