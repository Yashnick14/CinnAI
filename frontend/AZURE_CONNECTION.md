# Azure frontend connection verification — 29 October 2026

Development branch only; no push, merge, deployment or backend changes.

## Configuration

`frontend/.env` (ignored) and `.env.example` use:

EXPO_PUBLIC_API_URL=https://cinnai.wittymushroom-238da769.centralindia.azurecontainerapps.io

EXPO_PUBLIC_GRADING_MODE=api

EXPO_PUBLIC_SENSOR_MODE=wifi

EXPO_PUBLIC_SENSOR_WIFI_URL=http://192.168.10.126

Backend requests share src/config/api.ts. Image analysis uses sampleApi.ts -> /validate-sample?live=true; visualApi.ts -> /predict-visual; diameterApi.ts -> /measure-diameter; assistantApi.ts -> /assistant/ask. Legacy grading helpers still reference /api/v1/grade but are not used by AnalysingScreen. Local image URI fetches are photo reads, not backend addresses. Expo/Metro remains the local frontend development server.

Timeouts: visual/diameter 90 seconds, combined validation 180 seconds, assistant 120 seconds. Analysis displays a wake-up hint after 8 seconds without progress. Cancellation remains supported. No automatic upload retries or mock fallback were added.

## Live computer HTTP verification

Health: 200. Three original diameter_test_01/02/03 images uploaded as multipart image with capture_geometry.

| Image | Raw mm | Calibrated/display mm | Diameter grade | Visual | Validation |
|---|---:|---:|---|---|---|
| 01 | 30.857755 | 29.357755 | H2 | 422 no quill | 200 INVALID |
| 02 | 22.793277 | 21.293277 | H1 | 422 no quill | 200 INVALID |
| 03 | 20.128395 | 18.628395 | M4 | 422 no quill | 200 INVALID |

All diameter requests returned 200; raw and calibrated fields are preserved. Calibration occurs only in the backend. Segmentation passed. These V5 misses match previous local/Linux validation; they are not connectivity failures. RF success and a VALID final grade were not demonstrated with these images. An accepted real capture is still needed to verify that path live.

Streaming validation returned 200 application/x-ndjson with ordered detector, visual, diameter and decision events and final INVALID. Missing capture_geometry returned 422 as expected. Assistant general question, 19.4 mm sample question and handbook/reference question returned 200. The sample was M4; reference wording was not treated as a sample. Empty assistant input returned 422. Localhost:8081 browser CORS preflight returned 200 with matching origin.

Full live HTTP evidence is stored outside the repository in ../../azure-frontend-live-results.json and ../../azure-validation-stream.ndjson. Requests were made from the development computer, not the iPhone.

## Storage and security

Native history is local AsyncStorage plus persisted document images, scoped by Firebase UID. It continues to work without a laptop FastAPI server but does not synchronize across devices. Browser preview history uses its existing local repository and is not UID-scoped; this existing limitation was not changed. Azure capture/diagnostic files are ephemeral, not durable history. PostgreSQL remains disabled.

Firebase login remains unchanged. Backend /health, /predict-visual, /measure-diameter, /validate-sample and /assistant/ask accept requests without Firebase tokens. App sign-in is not backend authorization. Gemini credentials remain server-side; none were added to frontend.

## iPhone verification

From the project root:

```powershell
cd frontend
npm run go -- --clear
```

Scan the QR code with iPhone Camera and open Expo Go. Keep Metro running; local FastAPI is no longer needed. Sign in, capture a quill and coin, capture fresh moisture, Analyse, inspect validation/result, save and reopen history, and ask the assistant a question. Try cancel/retry and disconnect the sensor. These physical-device steps have not been performed by this audit.

iPhone needs internet for Azure and the ESP32's reachable local Wi-Fi for moisture. Allow Expo Go Local Network access in iOS settings. The sensor remains HTTP and cannot be reached through Azure or a Metro tunnel. Existing native BLE and native Google-sign-in development-build limitations remain; Wi-Fi and email/password are unchanged. No development build was created.

## Checks

TypeScript passed. Frontend: 236 tests passed across 22 files, including network/timeout/error handling, history, moisture and session regression tests. Model/inference/grading code and Firebase configuration were not modified.
