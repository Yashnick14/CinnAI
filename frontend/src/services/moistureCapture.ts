import { BLE } from "../config/ble";
import { MOISTURE_CAPTURE } from "../config/moistureCapture";
import type { SensorSnapshot } from "../types/sensor";
import { snapshotMoisture, type SessionMoisture } from "./sessionMoisture";

export interface MoistureCapture {
  startedAt: number;
  baselineTimestamp: string | null;
  baselineAdc: number | null;
  lastTimestamp: string | null;
  count: number;
  status: SessionMoisture["status"] | null;
  deviceId: string | null;
  captured: SessionMoisture | null;
}
export function beginMoistureCapture(
  sensor: SensorSnapshot,
  now = Date.now(),
): MoistureCapture {
  return {
    startedAt: now,
    baselineTimestamp: sensor.updatedAt,
    baselineAdc: sensor.medianAdc ?? null,
    lastTimestamp: sensor.updatedAt,
    count: 0,
    status: null,
    deviceId: sensor.device?.id ?? null,
    captured: null,
  };
}
export function usableCapture(
  capture: MoistureCapture,
  sensor: SensorSnapshot,
  now = Date.now(),
) {
  const reading = capture.captured;
  return (
    !!reading &&
    sensor.state === "connected" &&
    !sensor.error &&
    !sensor.stale &&
    sensor.device?.id === reading.device_id &&
    !!reading.timestamp &&
    now - Date.parse(reading.timestamp) >= 0 &&
    now - Date.parse(reading.timestamp) <= BLE.readingFreshnessMs
  );
}
export function advanceMoistureCapture(
  capture: MoistureCapture,
  sensor: SensorSnapshot,
  now = Date.now(),
): MoistureCapture {
  const reading = snapshotMoisture(sensor, now);
  if (
    reading.read_status !== "fresh" ||
    sensor.isMock ||
    (capture.captured && !usableCapture(capture, sensor, now))
  )
    return {
      ...capture,
      count: 0,
      status: null,
      captured: null,
      lastTimestamp: sensor.updatedAt,
    };
  if (capture.captured) return capture;
  const timestamp = Date.parse(sensor.updatedAt!);
  if (
    timestamp <= capture.startedAt ||
    timestamp <= Date.parse(capture.lastTimestamp ?? "") ||
    sensor.updatedAt === capture.lastTimestamp
  )
    return capture;
  const count =
    capture.status === reading.status && capture.deviceId === reading.device_id
      ? capture.count + 1
      : 1;
  return {
    ...capture,
    lastTimestamp: sensor.updatedAt,
    deviceId: reading.device_id,
    count,
    status: reading.status,
    captured:
      count >= MOISTURE_CAPTURE.consecutiveReadings ? { ...reading } : null,
  };
}
export function moistureQuality(
  reading?: SessionMoisture,
): "PASS" | "FAIL" | "UNAVAILABLE" {
  if (reading?.read_status !== "fresh") return "UNAVAILABLE";
  return reading.status === "PASS_PROVISIONAL"
    ? "PASS"
    : reading.status === "FAIL_PROVISIONAL"
      ? "FAIL"
      : "UNAVAILABLE";
}
