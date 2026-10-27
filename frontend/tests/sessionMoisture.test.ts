import { describe, expect, it } from "vitest";
import { snapshotMoisture } from "../src/services/sessionMoisture";
import type { SensorSnapshot } from "../src/types/sensor";

const now = Date.parse("2026-10-21T10:00:00Z");
const sensor = (patch: Partial<SensorSnapshot> = {}): SensorSnapshot => ({
  state: "connected",
  isMock: false,
  device: { id: "esp32", name: "CinnamonGradingSensor" },
  devices: [],
  medianAdc: 3000,
  moisturePercent: null,
  updatedAt: new Date(now).toISOString(),
  error: null,
  ...patch,
});
describe("sample moisture attachment", () => {
  it.each([
    [2841, "FAIL_PROVISIONAL"],
    [2842, "PASS_PROVISIONAL"],
    [3000, "PASS_PROVISIONAL"],
  ])("interprets ADC %s provisionally", (adc, expected) => {
    expect(
      snapshotMoisture(sensor({ medianAdc: Number(adc) }), now).status,
    ).toBe(expected);
  });
  it.each([
    [{ state: "connection_lost" }, "disconnected"],
    [{ updatedAt: new Date(now - 30001).toISOString() }, "stale"],
    [{ updatedAt: "bad" }, "invalid"],
    [{ updatedAt: new Date(now + 5000).toISOString() }, "invalid"],
    [{ medianAdc: null }, "missing"],
    [{ medianAdc: 4096 }, "invalid"],
    [{ error: "Invalid BLE value" }, "invalid"],
  ] as const)("does not classify unavailable readings %j", (patch, status) => {
    const result = snapshotMoisture(sensor(patch), now);
    expect(result.read_status).toBe(status);
    expect(result.status).toBe("UNAVAILABLE");
  });
  it("does not promote mock percentages or uncalibrated values", () => {
    expect(
      snapshotMoisture(sensor({ isMock: true, moisturePercent: 11.8 }), now),
    ).toMatchObject({ status: "DEMO", percentage: null });
    expect(
      snapshotMoisture(sensor({ moisturePercent: 11.8 }), now).percentage,
    ).toBeNull();
  });
  it("keeps the attached reading independent of later notifications", () => {
    const current = sensor();
    const saved = snapshotMoisture(current, now);
    current.medianAdc = 2000;
    current.state = "disconnected";
    expect(saved).toMatchObject({
      raw_value: 3000,
      status: "PASS_PROVISIONAL",
      connection_state: "connected",
    });
  });
});
