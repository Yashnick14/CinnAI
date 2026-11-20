# Real sensor with Expo Go over local Wi-Fi

## Upload in Arduino IDE

1. Open `CinnamonGradingWifi.ino` in this folder. Keep your original BLE sketch as a backup.
2. Copy `wifi_credentials.example.h` to `wifi_credentials.h` in the same folder.
3. Edit the new file with home Wi-Fi in slot 1 and your hotspot in slot 2.
   Optional slot 3 is for a third shared-password network. Never share that completed file.
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
  "median_adc": 1800,
  "sample_sequence": 12,
  "age_ms": 400,
  "threshold": 1711,
  "provisional": true,
  "status": "PASS"
}
```

1800 is an example; actual data comes from GPIO34. Nothing returns an exact
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

## Three networks and a phone on a different network

The sketch can use three saved shared-password networks. Set `WIFI_SSID_1` /
`WIFI_PASSWORD_1` for home, slot 2 for your hotspot, and the optional
`#define WIFI_SSID_3 "..."` / `#define WIFI_PASSWORD_3 "..."` for university.
Leave the third slot empty if university uses enterprise authentication or a
browser login: this sketch does not implement those methods. WiFiMulti selects
an available configured network; slot order is not a guaranteed priority.
Changing the credentials header requires another USB firmware upload.

Different-network phone access uses the existing cloud transport, not the local
`http://<ESP32-IP>/sensor` URL. Both devices need working internet access:

1. Provision a unique device credential using the existing backend operator command
   documented in `backend/app/cloud/README.md`, against the cloud database.
2. Copy `cloud_credentials.example.h` to the Git-ignored `cloud_credentials.h`.
   Configure the issued device ID/token, the trusted root CA for the Azure HTTPS
   endpoint, and set `CLOUD_ENABLED` to `1`. Never disable TLS verification.
3. Install ArduinoJson 7, Verify and upload the sketch, then open Serial Monitor
   at 115200. Wait for Wi-Fi, time synchronization and successful cloud telemetry.
4. Send `PAIR` with a newline in Serial Monitor. Enter the resulting temporary
   code in the signed-in app's cloud sensor pairing form.
5. Set `EXPO_PUBLIC_SENSOR_MODE=cloud` and `EXPO_PUBLIC_API_URL` to the Azure backend
   in the frontend environment, restart Expo with cache clearing, and select the
   paired device. The account's Firebase login authorizes access to its readings.
6. Test the ESP32 on home Wi-Fi while the phone uses mobile data, then test the
   saved hotspot and (if compatible) university network. A different phone signed
   into the same account can access the paired device. Turning off the ESP32 must
   make its reading unavailable/stale within the existing freshness rules.

Successful uploads follow the roughly three-second sampling loop plus HTTP latency.
The phone polls one second after each response while Sensor or ImageReview is
foregrounded, and two seconds after each response elsewhere. Requests never overlap.
Failures retain the 20/40/60-second retry backoff; freshness remains 30 seconds. Raw ADC is preserved. Screening uses 1711: below is FAIL, 1711–2849 is PASS, and 2850 or above is UNTOUCHED. This is not a calibrated 14% conversion. Cloud setup
must be completed before switching away from a working local sensor configuration.
