# Real sensor with Expo Go over local Wi-Fi

## Upload in Arduino IDE

1. Open `CinnamonGradingWifi.ino` in this folder. Keep your original BLE sketch as a backup.
2. Copy `wifi_credentials.example.h` to `wifi_credentials.h` in the same folder.
3. Edit the new file with both network names and passwords. Never share that completed file.
4. Use the same ESP32 board/COM port that worked previously, then Verify and Upload.
   The sketch uses libraries included in Espressif's Arduino ESP32 board package.
5. Open Serial Monitor at 115200 baud. Note the printed `http://<IP>/sensor` endpoint.
6. Connect iPhone and computer to that same Wi-Fi. Guest/client isolation must not
   block devices from talking to one another.

Sampling remains GPIO34, 12-bit ADC, 20 readings with 50 ms spacing, the integer
average of the two central readings, and a 2-second pause after each median.
The pauses service HTTP requests so the endpoint responds between sampling steps.
Wi-Fi reconnect attempts can delay a sampling cycle while disconnected.
No attenuation or sensor calibration settings have been added.

The sketch defaults to Wi-Fi only. `ENABLE_BLE=1` additionally enables the supplied
BLE name, UUIDs and integer notification format; Expo Go still uses only Wi-Fi.
Uploading replaces running firmware; the file itself does not flash the board.

## Test before opening the app

Visit `http://192.168.10.126/sensor` in iPhone Safari, using the actual address printed
on your board if it changed. Use **http**, not https. You should see JSON similar to:

```json
{
  "device": "CinnamonGradingSensor",
  "median_adc": 2903,
  "sample_sequence": 12,
  "age_ms": 400,
  "threshold": 2842,
  "provisional": true,
  "status": "PASS"
}
```

2903 is an example; actual data comes from GPIO34. Nothing returns an exact
moisture percentage. The threshold and labels remain PROVISIONAL. A disconnected
probe can still produce ADC numbers: these numbers do not prove correct sensor wiring.

## Open in Expo Go

The frontend environment now selects:

```env
EXPO_PUBLIC_SENSOR_MODE=wifi
EXPO_PUBLIC_SENSOR_WIFI_URL=http://192.168.10.126
```

Update the address after changing networks or if DHCP assigns a new IP. Keep the
grading API URL separate; this sensor endpoint is hosted by the ESP32, not FastAPI.

Run from the frontend folder:

```powershell
npm run go -- --clear
```

Open Expo Go using the QR code. Allow local-network access when prompted.
Open Sensor > Find Wi-Fi Sensor > Connect Sensor. Compare the ADC with Serial
Monitor, allowing for its approximately 3-second measurement cycle and 2-second
app polling interval. Last updated reflects the reported age of the sample.
Power off the board: values clear and an error appears after the next failed poll.
Power it back on, then tap Reconnect. Invalid/stale responses are rejected too.

The app never derives an exact moisture percent. Mock and native BLE modes remain
available as `mock` and `real`; no camera, grading, ML or backend changes are included.
The existing EAS development profile selects native BLE; it is not needed for Expo Go.

## Validation boundaries

Frontend parsing and lifecycle are covered by automated tests. Arduino IDE Verify,
Upload, and actual iPhone/ESP32 connectivity must be tested on your hardware.
This is an unauthenticated local prototype endpoint; no cloud service is required.
