# Architecture refactor report — 27 October 2026

## Changes

Before: active models mixed with handoff/evaluation files; flat screens; ML inference in the orchestration directory; assistant outside app; diameter orchestration in the route.
After: active models in `backend/models`; inference in `app/ml`; assistant in `app/ai_assistant`; diameter orchestration in services; screens grouped by feature; auth provider in context.

The table below enumerates source/artifact moves and renames. Directory moves also carried existing package data/cache files. Full original directory moves are recorded in the external evidence manifest.

| Old path | New path |
| --- | --- |
| `backend/app/measurement/coin_diagnostics.py` | `backend/app/ml/measurement/coin_diagnostics.py` |
| `backend/app/measurement/coin_reference.py` | `backend/app/ml/measurement/coin_reference.py` |
| `backend/app/measurement/config.py` | `backend/app/ml/measurement/config.py` |
| `backend/app/measurement/controlled.py` | `backend/app/ml/measurement/controlled.py` |
| `backend/app/measurement/diameter.py` | `backend/app/ml/measurement/diameter.py` |
| `backend/app/measurement/quill_edges.py` | `backend/app/ml/measurement/quill_edges.py` |
| `backend/app/measurement/segmentation_diameter.py` | `backend/app/ml/measurement/segmentation_diameter.py` |
| `backend/app/measurement/__init__.py` | `backend/app/ml/measurement/__init__.py` |
| `backend/app/ml/foreground.py` | `backend/legacy/ml/foreground.py` |
| `backend/app/ml/hybrid_grading.py` | `backend/legacy/ml/hybrid_grading.py` |
| `backend/app/ml/random_forest.py` | `backend/legacy/ml/random_forest.py` |
| `backend/app/ml/visual_features.py` | `backend/legacy/ml/visual_features.py` |
| `backend/app/ml/yolo_detector.py` | `backend/legacy/ml/yolo_detector.py` |
| `backend/app/services/feature_extraction.py` | `backend/app/ml/visual/feature_extraction.py` |
| `backend/app/services/model_service.py` | `backend/app/ml/visual/service.py` |
| `backend/app/services/segmentation_model_service.py` | `backend/app/ml/segmentation/service.py` |
| `backend/ai_assistant/cinnamon_assistant_final.py` | `backend/app/ai_assistant/cinnamon_assistant_final.py` |
| `backend/ai_assistant/measurement_intent.py` | `backend/app/ai_assistant/measurement_intent.py` |
| `backend/ai_assistant/retrieval.py` | `backend/app/ai_assistant/retrieval.py` |
| `backend/ai_assistant/schemas.py` | `backend/app/ai_assistant/schemas.py` |
| `backend/ai_assistant/service.py` | `backend/app/ai_assistant/service.py` |
| `backend/ai_assistant/__init__.py` | `backend/app/ai_assistant/__init__.py` |
| `frontend/src/hooks/useAuth.tsx` | `frontend/src/context/AuthContext.tsx` |
| `frontend/src/screens/AccountScreen.tsx` | `frontend/src/screens/Auth/AccountScreen.tsx` |
| `frontend/src/screens/AnalysingScreen.tsx` | `frontend/src/screens/Analyze/AnalysingScreen.tsx` |
| `frontend/src/screens/AssistantScreen.tsx` | `frontend/src/screens/Assistant/AssistantScreen.tsx` |
| `frontend/src/screens/AuthScreen.tsx` | `frontend/src/screens/Auth/AuthScreen.tsx` |
| `frontend/src/screens/CameraScreen.tsx` | `frontend/src/screens/Analyze/CameraScreen.tsx` |
| `frontend/src/screens/HistoryDetailScreen.tsx` | `frontend/src/screens/History/HistoryDetailScreen.tsx` |
| `frontend/src/screens/HistoryScreen.tsx` | `frontend/src/screens/History/HistoryScreen.tsx` |
| `frontend/src/screens/HomeScreen.tsx` | `frontend/src/screens/Home/HomeScreen.tsx` |
| `frontend/src/screens/ImageReviewScreen.tsx` | `frontend/src/screens/Analyze/ImageReviewScreen.tsx` |
| `frontend/src/screens/ManualReviewScreen.tsx` | `frontend/src/screens/Results/ManualReviewScreen.tsx` |
| `frontend/src/screens/PreparationScreen.tsx` | `frontend/src/screens/Analyze/PreparationScreen.tsx` |
| `frontend/src/screens/ResultScreen.tsx` | `frontend/src/screens/Results/ResultScreen.tsx` |
| `frontend/src/screens/SensorScreen.tsx` | `frontend/src/screens/Sensor/SensorScreen.tsx` |
| `frontend/src/screens/SettingsScreen.tsx` | `frontend/src/screens/Settings/SettingsScreen.tsx` |
| `frontend/src/screens/SplashScreen.tsx` | `frontend/src/screens/Home/SplashScreen.tsx` |
| `backend/backend_handoff/FINAL_QUILL_DETECTOR_YOLO11N.pt` | `backend/models/quill_detector_v5.pt` |
| `backend/backend_handoff/FINAL_QUILL_COIN_SEGMENTATION_YOLO11N.pt` | `backend/models/coin_quill_segmentation.pt` |
| `backend/backend_handoff/RF_VISION_8_CLASS.pkl` | `backend/models/rf_vision_8_class.pkl` |

## Import changes and other edits

`refactor-imports.patch` records every changed source line from the pre-refactor snapshot, including imports, monkeypatch paths, loader constants and assistant encoder-cache resolution. Test assertions were not weakened.

Changed source files:
- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/ml/measurement/controlled.py`
- `backend/app/ml/measurement/segmentation_diameter.py`
- `backend/app/ml/visual/service.py`
- `backend/app/services/sample_decision.py`
- `backend/app/api/routes/assistant.py`
- `backend/app/api/routes/diameter.py`
- `backend/app/api/routes/sample.py`
- `backend/app/api/routes/visual.py`
- `backend/app/ai_assistant/cinnamon_assistant_final.py`
- `backend/app/ai_assistant/retrieval.py`
- `backend/app/ai_assistant/service.py`
- `backend/tests/test_api.py`
- `backend/tests/test_assistant.py`
- `backend/tests/test_diameter.py`
- `backend/tests/test_model_service.py`
- `backend/tests/test_quill_edges.py`
- `backend/tests/test_segmentation_diameter.py`
- `backend/tests/test_visual_features.py`
- `backend/scripts/validate_quill_refinement.py`
- `backend/scripts/verify_visual.py`
- `backend/experiments/shadow_v5/shadow_replay.py`
- `frontend/src/components/HomeNavbar.tsx`
- `frontend/src/navigation/AppNavigator.tsx`
- `frontend/src/screens/Auth/AccountScreen.tsx`
- `frontend/src/screens/Analyze/AnalysingScreen.tsx`
- `frontend/src/screens/Assistant/AssistantScreen.tsx`
- `frontend/src/screens/Auth/AuthScreen.tsx`
- `frontend/src/screens/Analyze/CameraScreen.tsx`
- `frontend/src/screens/History/HistoryDetailScreen.tsx`
- `frontend/src/screens/History/HistoryScreen.tsx`
- `frontend/src/screens/Home/HomeScreen.tsx`
- `frontend/src/screens/Analyze/ImageReviewScreen.tsx`
- `frontend/src/screens/Results/ManualReviewScreen.tsx`
- `frontend/src/screens/Analyze/PreparationScreen.tsx`
- `frontend/src/screens/Results/ResultScreen.tsx`
- `frontend/src/screens/Sensor/SensorScreen.tsx`
- `frontend/src/screens/Settings/SettingsScreen.tsx`
- `frontend/src/screens/Home/SplashScreen.tsx`
- `frontend/tests/authNavigation.test.ts`
- `README.md`
- `backend/.dockerignore`
- `backend/.env.example`
- `backend/scripts/verify_visual.py`
- `frontend/App.tsx`

Additional documentation/configuration: root README; this report; architecture.md; models/README.md; Terraform README; backend .dockerignore; backend .env.example (cleared credential-like template value only).
New source: app/services/diameter_service.py; app/ml/visual/__init__.py; app/ml/segmentation/__init__.py.

## Deliberately preserved

All model contents, visual feature formulas, detector/segmentation options, coin size, grade/manual-review boundaries, calibration offset, moisture logic, assistant knowledge, API responses, Firebase behavior, frontend styling/navigation and history behavior.
No new backend auth/history endpoints, Terraform resources, database activation or Azure deployment.
Legacy candidates and residual deployment debt are described in architecture.md. Bulk evidence was not moved back into production; previously blocked cleanup deletions remain outstanding.

## Verification

Backend: 170 tests passed. Frontend: 235 tests passed; TypeScript passed; web export passed.
Real checkpoint/artifact loading and real-image endpoint checks are recorded in the external runtime-checks.json report. Assistant API tests use controlled dependencies; no live Gemini request or physical iPhone/sensor test is claimed.

## Git readiness / next step

Local `git init` is safe, but do not blindly add/push the whole folder. Rotate the credential-like value previously present in .env.example; runtime .env was untouched. The retained original notebook also needs secret-output review before staging. Keep secrets, old models, captures and caches excluded; provision the three model binaries separately.
Review the staged diff and run secret scanning before GitHub. Then define CI model/encoder provisioning and verify a Linux runtime container before writing Terraform. Existing backend authorization and web history isolation require separate behavior-changing tasks.

## Final runtime checks

Web and iOS Hermes exports both passed. The iOS export required a writable workspace TEMP directory because the sandbox's default temp path denied Hermes output.
All three checkpoints loaded; detector metadata is detect/Quill, segmentation metadata is segment/Coin+Quill. SHA256 values match before and after (see models/README.md). Assistant JSON and 62 x 384 matrix loaded.
Feature extraction and calibration configuration are byte-for-byte unchanged; extracted diameter orchestration class/function are AST-identical to the previous route bodies.

Three original fixture images were replayed with valid square capture geometry:

| Image | Diameter HTTP status | Calibrated mm | Visual / sample validation |
|---|---|---|---|
| diameter_test_01.jpg | 200 | 29.357755 | 422 no quill / INVALID |
| diameter_test_02.jpg | 200 | 21.293277 | 422 no quill / INVALID |
| diameter_test_03.jpg | 200 | 18.628395 | 422 no quill / INVALID |

The saved pre-refactor visual and measurement implementations were replayed with the same current models and input bytes: all results/errors matched exactly. The V5 rejection on these historical fixtures is pre-existing, not corrected by this refactor. Successful RF response contracts remain covered by the regression tests; these three images do not demonstrate successful real RF inference.
`runtime/baseline-parity.json` in external evidence is authoritative for this replay. The earlier runtime-checks inventory used synthetic non-square geometry on two fixtures; the corrected replay above supersedes those measurement statuses.

`refactor-moves.json` additionally enumerates carried package data/cache files. `refactor-imports.patch` redacts the old credential-like template value. Backend README and assistant README were updated to distinguish current paths from historical validation notes.
