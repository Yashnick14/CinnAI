# Run CinnAI on a physical iPhone from Windows

## Free Expo Go workflow

The project is aligned with Expo SDK 57 so it can run in the App Store version
of Expo Go without Apple Developer Program membership.

1. Install **Expo Go** from the iPhone App Store.
2. Sign into Expo Go with the same Expo account used by the terminal: `yashnick`.
3. Connect the Windows computer and iPhone to the same Wi-Fi network.
4. From the `frontend` directory, run:

```powershell
npm ci
npm run go
```

5. Scan the terminal QR code with the normal iPhone Camera app and open it in
   Expo Go. Keep the terminal running while using the application.

If the phone cannot connect over the local network, stop Metro with `Ctrl+C`
and run:

```powershell
npx expo start --go --tunnel
```

Expo Go supports the real camera, captured image review, explicit mock result,
and local history used in this phase. It does not install a separately branded
CinnAI binary, and it cannot validate the custom bundle ID, native permission
text, app icon, or future custom BLE native code.

## Optional EAS development build

The app uses Expo SDK 57, React Navigation, TypeScript, `expo-camera`,
`expo-file-system`, and `expo-dev-client`. The development profile in `eas.json`
creates an internal iOS development build. Xcode is not required because EAS
performs the native build in the cloud.

## Accounts required

You need an Expo account and an active paid Apple Developer Program membership,
or access to an Apple Developer team with permission to create signing
credentials and register devices. EAS asks for the Apple credentials needed to
create the development certificate and provisioning profile. A free personal
Apple ID can only sign locally with Xcode on macOS, so it cannot provide this
Windows-to-EAS physical-device workflow.

On iOS 16 or later, enable Developer Mode when the phone prompts you after the
development build is installed.

## First-time commands in VS Code

Open the project folder in VS Code, choose **Terminal → New Terminal**, then run:

```powershell
cd "C:\Users\Yashnick\Documents\Codex\2026-10-11\files-pasted-by-the-user-i\outputs\CinnamonHybridGrading\frontend"
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run typecheck
npm test
npx eas-cli@latest login
npx eas-cli@latest init
```

`eas init` creates or links the Expo project. Because this repository uses a
dynamic `app.config.ts`, copy the real project UUID printed by EAS (also visible
on the Expo project page) into the checked configuration with:

```powershell
npm run eas:link -- 00000000-0000-0000-0000-000000000000
```

Replace the example UUID with the actual UUID. Never leave the example value in
the file. You can verify the result with:

```powershell
npx expo config --type public
```

The configured iOS bundle identifier is
`com.yashnick.cinnamonhybridgrading`. If Apple reports that it belongs to
another developer, choose a unique reverse-domain identifier in
`frontend/app.config.ts` before building.

## Register and build

Connect the iPhone to the registration flow when prompted:

```powershell
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
```

Open the installation URL or QR code produced by EAS on the registered iPhone
and install CinnAI. Registering another phone or changing native settings such
as permissions requires a new development build and provisioning profile.

## Run the development server

After the development client is installed, run this from `frontend` whenever
you develop:

```powershell
npx expo start --dev-client
```

Keep the Windows computer and iPhone on a network where they can reach each
other. Open CinnAI on the iPhone and select the Metro server. If local network
discovery is blocked, use Expo's supported tunnel option:

```powershell
npx expo start --dev-client --tunnel
```

The first camera launch asks for camera access. If it is denied permanently,
the app opens iOS Settings. No microphone, photo-library, Bluetooth, or location
permission is requested in this phase.

## Device acceptance check

1. Open CinnAI and tap **New Grading**.
2. Continue from Preparation to the real rear camera.
3. Capture cinnamon and a current Rs.10 coin, then verify the actual photo.
4. Retake once, capture again, and choose **Analyse**.
5. Confirm the result is visibly labelled as demo/mock data.
6. Save it, open History, and open the saved record.
7. Force-close and reopen the app; confirm the record and photo still load.
8. Deny camera access and verify the Settings recovery path.
9. Background and reopen the app while on Camera; verify the preview restarts.

The source and configuration are ready for this build flow. The signed EAS
build, Apple provisioning, installation, and physical-camera checks must be
completed using your accounts and iPhone.

