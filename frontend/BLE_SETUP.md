# ESP32 BLE sensor testing

This phase adds foreground BLE sensor testing only. Camera, grading, backend,
database, YOLO and Random Forest flows are unchanged. Existing grading fixtures
remain fixtures and do not consume ADC data.

## Contract

- Advertised name: `CinnamonGradingSensor`
- Service: `7f510001-8c3d-4b89-a9e7-71c3a0000001`
- Notify characteristic: `7f510002-8c3d-4b89-a9e7-71c3a0000001`
- Payload: UTF-8 decimal integer, e.g. `2903`. BLE PLX exposes its bytes as base64;
  the adapter decodes the bytes and validates ASCII integer text (valid UTF-8).
- Accepted range: 0–4095, assuming ESP32's standard 12-bit ADC configuration.
  Confirm firmware resolution before using another range.
- **PROVISIONAL ADC_THRESHOLD = 2842**, centralized in `src/config/ble.ts`.
  ADC >= 2842: PASS / Below 14%; ADC < 2842: FAIL / 14% or Above.
- These labels are provisional threshold bands, not calibrated percentages.
  Real sensor snapshots always have `moisturePercent: null`.
- No notification for 30 seconds: show stale reading and suppress the live
  PASS/FAIL label until another notification arrives.
- Invalid values clear ADC, timestamp and status; a subsequent valid value recovers.
- Reconnect is explicit: it scans again and connects the discovered matching device.
  There is no unbounded automatic reconnect loop or background BLE support.

## Native configuration

Installed `react-native-ble-plx` 3.5.1, `base-64`, and `@types/base-64`.
The built-in BLE Expo plugin adds the iOS Bluetooth usage description and Android
Bluetooth permissions. Background operation is disabled; Android scan data is not
used for location (`neverForLocation: true`). Android 12+ asks for Nearby Devices
permissions; older Android requests location permission as required for BLE scanning.
iOS asks for Bluetooth permission when the BLE manager is first used.
The existing development EAS profile now explicitly selects real sensor mode.

Expo Go cannot load this native BLE module. Mock mode remains usable there.
Rebuild the native development client after installing this library/config plugin.

## iOS cloud Development Build from Windows

An active paid Apple Developer Program membership (or access to a team that has one)
is required for EAS to sign an installable physical-iPhone build. A regular Apple ID
alone cannot complete this route. Do not pay for an Expo plan just for this step;
Apple signing and Expo build service access are separate.

Run in PowerShell from this frontend directory:

```powershell
npx eas-cli@latest login
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
```

Use the device registration link on the actual iPhone before starting the build.
Select the Apple team and include that iPhone in provisioning when prompted.
The project is already linked, so `eas init` is unnecessary.
Install from the completed EAS build page on the registered iPhone.
Enable Settings > Privacy & Security > Developer Mode when required, then restart.
Start Metro:

```powershell
npm start -- --clear
```

Open the installed **CinnAI Development Build**, not Expo Go. Use its launcher or
scan Metro's development-client QR code. Phone and computer should share Wi-Fi
for Metro. The BLE sensor link itself does not require Wi-Fi, Docker or FastAPI.

Free signing alternative: on a Mac with Xcode and this project, install dependencies,
run `npx expo prebuild --platform ios`, open `ios/*.xcworkspace` in Xcode, choose your
Apple ID Personal Team under Signing & Capabilities, select the attached iPhone and
Run. Personal Team limits apply. This is not a Windows/EAS workaround.

Official guidance:

- https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/guides/ios-developer-mode/
- https://github.com/dotintent/react-native-ble-plx

## Real hardware test checklist

1. Set `EXPO_PUBLIC_SENSOR_MODE=real` in `.env` (already selected), restart Metro.
2. Power ESP32 and ensure it advertises the exact name above. Disconnect any other
   phone/app connected to it. Keep it close to your iPhone.
3. Turn Bluetooth on in iPhone Settings. Open Sensor and tap Scan for Sensor.
4. Allow the iOS Bluetooth prompt. Tap Connect Sensor on CinnamonGradingSensor.
5. Verify connected state, integer median ADC and last-updated time advance as
   notifications arrive. Compare with ESP32 serial output.
6. Send 2903: PASS / Below 14%. Send 2842: PASS. Send 2841: FAIL / 14% or Above.
7. Send `abc` or `4096`: invalid-value message, no retained PASS/FAIL; send a valid
   integer to recover. Do not change or flash firmware through this app.
8. Stop notifications while keeping the connection: after 30 seconds see stale status.
9. Power off ESP32: connection-lost message and cleared values. Power it on, then
   tap Reconnect and confirm readings resume.
10. Turn Bluetooth off while connected: Bluetooth-off message and cleared values.
    Turn it on in Settings and tap Reconnect.
11. Deny/revoke Bluetooth access in Settings > Privacy & Security > Bluetooth:
    permission-denied guidance. Restore permission and retry.
12. Power off the sensor before scanning: after 10 seconds see device-not-found.

## Hardware-free mock testing

Change only `EXPO_PUBLIC_SENSOR_MODE=mock` in `.env`, restart Metro with clear cache.
Existing demo readings and failure simulation controls remain labelled DEMO; those
percentages are old explicit fixtures, never calculated from ADC. Set mode back to
real and restart Metro before hardware testing.

## Verification boundaries

Automated fake-manager tests validate parsing, threshold boundaries, permissions,
scan timeout, discovery, subscriptions, invalid values, disconnection and reconnect.
TypeScript and Expo configuration/bundle checks do not prove native compilation or
physical ESP32 operation. An actual signed iOS build and the hardware checklist
above are still required. Do not claim sensor calibration from these tests.
