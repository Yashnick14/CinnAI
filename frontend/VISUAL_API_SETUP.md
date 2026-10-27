# Visual grading on iPhone

The active path is Preparation > Camera > Image Review > Analysing > Result.
The captured photo is uploaded as multipart field `image` to `/predict-visual`.
The existing Expo SDK 57 Blob-compatible File helper sets the image part; fetch
sets the multipart content type and boundary automatically.

## Start the app

Start the backend from its folder:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

In frontend `.env`, configure the laptop's current Wi-Fi IPv4 address:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.250:8000
```

This is the Windows laptop address, separate from the ESP32 sensor address.
Use `ipconfig` if the laptop changes networks. Localhost, loopback and wildcard
addresses are rejected for the phone's API base URL. Keep only the base URL here;
the app appends `/predict-visual` itself.

Restart Metro from the frontend folder after changes:

```powershell
npm run go -- --clear
```

Connect iPhone and laptop to the same Wi-Fi. Test `http://192.168.1.250:8000/health`
in iPhone Safari, then open the app in Expo Go. Allow local-network access.
Capture a photo, wait for the preview to load, tap Analyse, and check the backend
terminal for `POST /predict-visual` with HTTP 200. A fresh native build is not needed.

## Behaviour

- Always uses the real visual endpoint, regardless of the retired demo grading flag.
- Displays uploading/analyzing together because the single API call does not expose
  separate server progress events. It never invents per-stage completion progress.
- Validates all eight probabilities, ranges, sum and prediction/confidence consistency.
- Displays the photo, count, visual prediction, visual confidence and every probability.
- No quill/usable features: clear message, retry or return to camera.
- Network failure/timeout/404/5xx: backend-unavailable message with retry.
- Invalid JSON or response contract: invalid-response message.
- Leaving analysis cancels the client request; cancelled responses cannot navigate.
  The server may still finish an inference that it already started.
- Never substitutes mock results for network or model failures.

This flow does not calculate or display diameter, moisture, a final hybrid grade,
or save new results to history. Sensor and legacy history screens remain separate.
Old mock services and legacy record types remain for their existing tests/history
but the active grading screens do not call them or `/api/v1/grade`.
Backend inference and camera capture mechanics were not modified by this integration.

## Verify

```powershell
npm run typecheck
npm test
```

The transport tests exercise the multipart payload, endpoint, schema validation,
no-quill response, backend failure, timeout and cancellation. Physical iPhone
camera-to-backend testing is still required after restarting Expo Go.
