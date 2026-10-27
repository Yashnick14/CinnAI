# ESP32 integration — pending

The app currently uses a clearly labelled mock sensor adapter.
Before real BLE integration, supply service UUID, moisture characteristic UUID, device naming/filtering,
notify/read capabilities, payload encoding (e.g. text JSON or binary), units,
sensor calibration procedure, and firmware connection behavior.

Proposed mobile library: react-native-ble-plx, to be installed and configured when implementing the native adapter.
Use an Expo Development Build and rebuild after adding its config plugin or permissions.
No real UUIDs or payload format are assumed. No firmware or ML runs on the ESP32 in this phase.

