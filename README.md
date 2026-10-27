# CinnAI — Cinnamon Hybrid Grading

FastAPI inference, Expo/React Native presentation, and independent ESP32 firmware.
The official application grade comes from **calibrated diameter**: `max(raw_mm - 1.5, 0)`.
The offset is preliminary empirical calibration from six samples, not universal validation.
Raw diameter is retained; RF supplies visual evidence and moisture remains a separate quality check.

## Structure

- `backend/app/api/routes/`: HTTP validation and response contracts.
- `backend/app/services/`: sample decisions, diameter orchestration, upload/diagnostic storage.
- `backend/app/ml/visual/`: V5 detection plus unchanged training-era 21-feature RF inference.
- `backend/app/ml/segmentation/`: independent lazy Coin/Quill model.
- `backend/app/ml/measurement/`: active segmentation diameter and retained comparison implementation.
- `backend/app/ai_assistant/`: assistant service, retrieval, knowledge and embeddings.
- `backend/app/core/`: configuration. Existing database scaffolding is inactive.
- `backend/models/`: the three active model artifacts (see its README).
- `backend/tests/`: regression suite; keep in Git, exclude from runtime images.
- `backend/legacy/`: inactive ML scaffolding. See `docs/architecture.md` for retained legacy modules.
- `frontend/src/screens/`: Home, Analyze, Results, History, Assistant, Auth, Sensor and Settings.
- `frontend/src/context/`: authentication provider; hooks/services/storage retain existing behavior.
- `firmware/`: ESP32 BLE/Wi-Fi firmware; keep real credentials private.
- `infrastructure/terraform/`: future deployment planning only.

## Run locally (PowerShell)

From `backend`, after installing `requirements.txt` into `.venv` and configuring `.env`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

From `frontend`, install with `npm ci`, configure `.env`, then:

```powershell
npm run go
```

Use `npm run web` for web. Wi-Fi sensor mode works in Expo Go; native BLE/Google sign-in require a development build.
The iPhone API URL must use the laptop LAN IP; keep phone and laptop on the same network.

## Configuration

Copy each `.env.example` to `.env` only if `.env` does not already exist.
Backend: `MODEL_DIRECTORY` optionally overrides `backend/models`; `ALLOWED_ORIGINS`, `MAX_IMAGE_BYTES`,
`TEMP_VISUAL_UPLOAD_DIRECTORY`, and `GEMINI_API_KEY` configure existing behavior.
The assistant encoder cache remains `backend/data/assistant-encoder`.
Frontend: `EXPO_PUBLIC_API_URL`, grading/sensor mode, sensor Wi-Fi URL, Firebase and Google client configuration.
Do not put server credentials in Expo public variables. Database settings are legacy; PostgreSQL is not required by active inference.

Active endpoints: `GET /health`, `POST /predict-visual`, `POST /measure-diameter`,
`POST /validate-sample` (streaming via `?live=true`), `POST /assistant/ask`.
Authentication uses Firebase on the frontend; history uses existing frontend storage. There are no active backend auth/history routes.

## Verification

```powershell
# backend
.\.venv\Scripts\python.exe -m pytest
# frontend
npm run typecheck
npm test
npm run export:web
```

Tests and reproducibility scripts stay in Git. Models, secrets, encoder cache, historical captures,
build outputs and FYP evidence need separate provisioning/storage. See `docs/refactor-report.md`.
No Azure resources have been deployed.
