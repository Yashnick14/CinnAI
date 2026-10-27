import { ADC_THRESHOLD, BLE } from "../config/ble";
import type { SensorSnapshot, SensorState } from "../types/sensor";

export interface SessionMoisture {
  raw_value: number | null;
  percentage: null;
  status: "PASS_PROVISIONAL" | "FAIL_PROVISIONAL" | "UNAVAILABLE" | "DEMO";
  timestamp: string | null;
  attached_at: string;
  connection_state: SensorState;
  read_status:
    "fresh" | "stale" | "missing" | "disconnected" | "invalid" | "demo";
  source: "ble" | "wifi" | "mock";
  device_id: string | null;
}

// Copy primitive values only: later notifications must not change a graded sample.
export function snapshotMoisture(
  sensor: SensorSnapshot,
  now = Date.now(),
): SessionMoisture {
  const raw = sensor.medianAdc;
  const validRaw =
    typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= 0 &&
    raw <= BLE.adcMax;
  const age = sensor.updatedAt ? now - Date.parse(sensor.updatedAt) : NaN;
  const read_status: SessionMoisture["read_status"] = sensor.isMock
    ? "demo"
    : sensor.state !== "connected"
      ? "disconnected"
      : sensor.error || (raw != null && !validRaw)
        ? "invalid"
        : !validRaw || !sensor.updatedAt
          ? "missing"
          : !Number.isFinite(age) || age < -1000
            ? "invalid"
            : sensor.stale || age > BLE.readingFreshnessMs
              ? "stale"
              : "fresh";
  if (BLE.mode === "wifi" && !sensor.isMock) {
    console.info("[moisture:wifi] session freshness", {
      adc: raw ?? null,
      timestamp: sensor.updatedAt,
      readingAgeMs: Number.isFinite(age) ? age : null,
      readStatus: read_status,
      reason:
        read_status === "fresh"
          ? null
          : sensor.error ||
            (read_status === "stale"
              ? "Reading exceeds 30000 ms freshness limit or sensor marked stale."
              : read_status),
    });
  }
  return {
    raw_value: validRaw ? raw : null,
    // Neither native BLE nor Wi-Fi currently supplies a calibrated percentage.
    percentage: null,
    status:
      read_status === "demo"
        ? "DEMO"
        : read_status === "fresh"
          ? raw! >= ADC_THRESHOLD
            ? "PASS_PROVISIONAL"
            : "FAIL_PROVISIONAL"
          : "UNAVAILABLE",
    timestamp: sensor.updatedAt,
    attached_at: new Date(now).toISOString(),
    connection_state: sensor.state,
    read_status,
    source: sensor.isMock ? "mock" : BLE.mode === "wifi" ? "wifi" : "ble",
    device_id: sensor.device?.id ?? null,
  };
}
