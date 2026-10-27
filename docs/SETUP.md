# Windows and iPhone setup

## Prerequisites

- Node.js 22.14 or a supported newer LTS version and npm.
- Python 3.12+ for the foundation backend (use the trained model's environment later).
- Expo account and Apple signing/device setup for an iOS EAS development build.
- An iPhone for native camera testing. No local Xcode workflow is assumed.

## Mobile

From frontend:

```powershell
npm ci
Copy-Item .env.example .env
npm run typecheck
npm test
```

For the free physical-iPhone workflow, install Expo Go from the App Store, sign
in as `yashnick`, and run:

```powershell
npm run go
```

Scan the QR code with the iPhone Camera app. Use `npx expo start --go --tunnel`
if the phone cannot reach Metro over the local network.

The default is local mock grading plus mock sensor; the backend is optional in this mode.
The following EAS steps are optional and require Apple Developer membership.
The configured bundle ID is `com.yashnick.cinnamonhybridgrading`; change it only if Apple reports that it is unavailable.
Then link the project to your Expo account and create a development build:

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
npm run eas:link -- YOUR-ACTUAL-EAS-PROJECT-UUID
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
npm start
```

Install the EAS development build on the registered iPhone, then open the development server.
This is an Expo Development Build workflow. Expo Go is not the supported native target.
No EAS build has been submitted by this scaffold; account login, signing and device registration
must be completed in your environment.
Use the same reachable network for Metro, or use Expo's documented tunnel workflow if needed.
See `docs/IPHONE_SETUP.md` for the complete registration, installation and device checklist.

## Backend

Start Docker Desktop first. From the project root, start PostgreSQL:

```powershell
.\scripts\start-database.ps1
```

This starts PostgreSQL 17 on `localhost:5432` with a persistent Docker volume.
The development credentials are defined in `docker-compose.yml` and
`backend/.env.example`; replace them before any shared or deployed environment.

From backend:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt -c constraints-tested.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open http://localhost:8000/docs to exercise multipart upload.
GET /health reports mock mode and models_loaded=false.
POST /api/v1/grade accepts image (JPEG/PNG, max 10 MiB and 24 megapixels),
optional moisture_percent (0–100), and optional mock_scenario.
JPEG/PNG validation is not image analysis.
Successful requests store the complete mock result in PostgreSQL and the validated
image in `backend/data/grading-images`. `GET /api/v1/records`,
`GET /api/v1/records/{id}`, and `GET /api/v1/records/{id}/image` retrieve them.

Example from Windows:

```powershell
curl.exe -F "image=@sample.jpg" -F "moisture_percent=11.8" -F "mock_scenario=accepted" http://localhost:8000/api/v1/grade
```

Do not deploy this unauthenticated demo endpoint as a production service.
It validates file size after multipart parsing; production deployment also needs ingress body limits.

## Future API integration (not used by the current mobile workflow)

Edit frontend/.env using the Windows computer's current Wi-Fi IPv4 address:

```dotenv
EXPO_PUBLIC_GRADING_MODE=api
EXPO_PUBLIC_SENSOR_MODE=mock
EXPO_PUBLIC_API_URL=http://YOUR-COMPUTER-IP:8000
```

Replace the example with your actual endpoint and restart Metro.
The iPhone's localhost is the iPhone, not the Windows computer.
For Expo Go development, the iPhone and computer must share a reachable network.
Allow your development server through Windows Firewall on the intended network when needed.
Public Expo variables are not secret storage.

The transport remains available for later integration, but the current camera flow deliberately calls the local mock service only.

## Browser preview

```powershell
npm run web
```

Browser preview is for UI inspection and local mock flow. Camera requires browser permission and a
secure context (localhost works). It does not validate native iPhone camera, BLE, signing, or EAS.
API multipart transport targets React Native; use iPhone or /docs for API upload checks.
Browser history uses browser storage and embeds captured images; native history uses files.

## Reference documentation

- https://docs.expo.dev/versions/v55.0.0/
- https://docs.expo.dev/versions/v55.0.0/sdk/camera/
- https://docs.expo.dev/versions/v55.0.0/sdk/filesystem/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/build/setup/
- https://reactnavigation.org/docs/7.x/getting-started/
- https://fastapi.tiangolo.com/tutorial/request-files/

