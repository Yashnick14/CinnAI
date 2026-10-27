# Validation record — 14 October 2026

## Physical iPhone camera phase

- TypeScript passes and the frontend suite has 32 passing tests, including durable photo copy, missing-file rejection and iOS container URI rebasing.
- Expo config introspection confirms app name CinnAI, bundle ID `com.yashnick.cinnamonhybridgrading`, the intended camera usage description, `expo-dev-client`, and no microphone permission.
- Native iPhone camera behavior, EAS signing and device installation remain physical/account checks and are not claimed as completed in this Windows workspace.
- The frontend was aligned with Expo SDK 57 for the free App Store
  Expo Go workflow. Expo-compatible dependency versions, TypeScript, tests and
  the JavaScript bundle were revalidated after the change.

## FastAPI and PostgreSQL phase

- Backend suite: 24 tests passed, including persisted records, record listing,
  image retrieval, validation boundaries and missing-record responses.
- Frontend suite: 34 tests passed, including the API upload workflow and fixed
  local mock boundary.
- Docker Compose configuration and the database startup script parse correctly.
- Docker Desktop was installed but its engine did not become ready in this
  session, so a live PostgreSQL container smoke test remains to be run locally.

## Mockup-inspired refresh

- TypeScript passed; frontend suite now has 29 passing tests.
- Expo export passed for web, iOS and Android (including native Hermes bytecode).
- The generated decorative hero is bundled locally; no remote image dependency.
- The in-app browser could not reach the static preview server either; native and visual
  walkthroughs remain pending. See DESIGN.md for changes and restart instructions.

The foundation validation below records the earlier backend and service checks.

## Passed

- Frontend TypeScript: `npm run typecheck`.
- Frontend service/storage/transport tests: `npm test` — 25 passed.
- Backend API tests: `python -m pytest -q` — 21 passed.
- Expo dependency compatibility: `npx expo install --check` — dependencies up to date.
- iOS production JavaScript and Hermes bytecode: `npx expo export --platform ios --max-workers 2` — passed, 969 modules.

Total: 46 automated tests. These validate the application foundation and mock contracts,
not model accuracy, physical measurements, or a signed native app.

## Not completed in this environment

- Browser visual walkthrough: local headless Edge failed to launch; the in-app browser could
  not reach the Metro preview. No successful screenshot or full UI walkthrough is claimed.
- Native iPhone camera, permissions, image persistence and navigation acceptance testing.
- EAS cloud build, Apple signing and installation on a registered iPhone.
- Real BLE and ML/measurement validation: deliberately pending the supplied artifacts.

Use TESTING.md for the device acceptance sequence. Browser preview is optional and does not
replace native testing.

## Environment notes

Validated using Node 22.14, Expo SDK 55 and bundled Python 3.12 on Windows.
This workspace's Python installation could not create a venv, so test dependencies were installed
in an isolated scratch package directory and supplied through PYTHONPATH. Normal venv setup
instructions are included for the user's development environment.
Expo/Hermes initially could not write to the sandbox's temporary directory; rerunning with
TEMP/TMP pointing to workspace scratch space succeeded. No project workaround is required.
The backend test client emitted one dependency deprecation warning about httpx; all tests passed.
The frontend lockfile and backend constraints-tested.txt record dependency versions.
