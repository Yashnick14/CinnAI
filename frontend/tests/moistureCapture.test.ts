import { expect, it } from "vitest";
import {
  advanceMoistureCapture,
  beginMoistureCapture,
  usableCapture,
  moistureQuality,
} from "../src/services/moistureCapture";
import { finalSummary } from "../src/services/finalSummary";
import type { SensorSnapshot } from "../src/types/sensor";
import type { SampleResult } from "../src/types/decision";

const start = Date.parse("2026-10-22T10:00:00Z");
function sensor(offset = 0, adc = 1800): SensorSnapshot {
  return {
    state: "connected",
    isMock: false,
    device: { id: "esp", name: "sensor" },
    devices: [],
    medianAdc: adc,
    moisturePercent: null,
    updatedAt: new Date(start + offset).toISOString(),
    error: null,
  };
}
function captured(adc = 1800) {
  let c = beginMoistureCapture(sensor(), start);
  for (const offset of [2000, 4000, 6000])
    c = advanceMoistureCapture(c, sensor(offset, adc), start + offset);
  return c;
}
it("does not accept old or duplicate readings", () => {
  let c = beginMoistureCapture(sensor(), start);
  c = advanceMoistureCapture(c, sensor(), start + 1000);
  expect(c.count).toBe(0);
  c = advanceMoistureCapture(c, sensor(2000), start + 2000);
  c = advanceMoistureCapture(c, sensor(2000), start + 1800);
  expect(c.count).toBe(1);
  expect(c.captured).toBeNull();
});
it.each([
  [1800, "PASS"],
  [1711, "PASS"],
  [1710, "FAIL"],
] as const)("captures fresh ADC %d after three readings", (adc, status) => {
  const c = captured(adc);
  expect(c.count).toBe(3);
  expect(c.captured?.raw_value).toBe(adc);
  expect(c.captured?.percentage).toBeNull();
  expect(moistureQuality(c.captured!)).toBe(status);
});
it("resets consecutive count if status changes", () => {
  let c = beginMoistureCapture(sensor(), start);
  c = advanceMoistureCapture(c, sensor(2000), start + 2000);
  c = advanceMoistureCapture(c, sensor(4000, 1650), start + 4000);
  expect(c.count).toBe(1);
  expect(c.captured).toBeNull();
});
it("invalidates disconnected and stale captures before Analyse", () => {
  const c = captured();
  expect(usableCapture(c, sensor(36000), start + 36000)).toBe(true);
  expect(usableCapture(c, sensor(36001), start + 36001)).toBe(false);
  expect(
    advanceMoistureCapture(c, { ...sensor(6000), state: "disconnected" }, start + 7000)
      .captured,
  ).toBeNull();
  expect(advanceMoistureCapture(c, sensor(6000), start + 37000).captured).toBeNull();
});
it("keeps snapshot fixed while live ADC changes and never accepts mock", () => {
  const c = captured();
  expect(advanceMoistureCapture(c, sensor(8000, 2000), start + 8000).captured).toEqual(
    c.captured,
  );
  expect(
    advanceMoistureCapture(
      beginMoistureCapture(sensor(), start),
      { ...sensor(2000), isMock: true },
      start + 2000,
    ).count,
  ).toBe(0);
});
it.each([
  [1800, "PASS"],
  [1650, "FAIL"],
] as const)("diameter grade remains M4 with RF H1 and moisture %s", (adc, quality) => {
  const result = {
    status: "VALID",
    final_grade: "M4",
    diagnostics: {
      diameter: { diameter_grade: "M4" },
      visual: { visual_prediction: "H1" },
    },
    moisture: captured(adc).captured,
  } as SampleResult;
  expect(finalSummary(result)).toEqual({
    grade: "M4",
    exportQuality: quality,
  });
  expect(finalSummary({ ...result, moisture: undefined })).toEqual({
    grade: "M4",
    exportQuality: "UNAVAILABLE",
  });
  expect(finalSummary({ ...result, status: "INVALID" })).toEqual({
    grade: null,
    exportQuality: "UNAVAILABLE",
  });
});

it.each([2850, 2975, 4095])("never captures untouched ADC %d", (adc) => {
  const c = captured(adc);
  expect(c.captured).toBeNull();
  expect(c.count).toBe(0);
});
it("contact loss clears a pending capture and requires three new contact readings", () => {
  let c = beginMoistureCapture(sensor(), start);
  c = advanceMoistureCapture(c, sensor(2000), start + 2000);
  expect(usableCapture(c, sensor(8000, 2850), start + 8000)).toBe(false);
  c = advanceMoistureCapture(c, sensor(8000, 2850), start + 8000);
  expect(c.captured).toBeNull();
  for (const offset of [10000, 12000]) {
    c = advanceMoistureCapture(c, sensor(offset, 2849), start + offset);
    expect(c.captured).toBeNull();
  }
  c = advanceMoistureCapture(c, sensor(14000, 2849), start + 14000);
  expect(c.captured?.status).toBe("PASS_PROVISIONAL");
});

it("retains a completed snapshot when the probe becomes untouched", () => {
  const c = captured(1800);
  const lifted = sensor(8000, 2975);
  expect(usableCapture(c, lifted, start + 8000)).toBe(true);
  expect(advanceMoistureCapture(c, lifted, start + 8000)).toBe(c);
  expect(c.captured?.raw_value).toBe(1800);
  expect(usableCapture(c, lifted, start + 37000)).toBe(false);
  expect(
    usableCapture(
      c,
      { ...lifted, device: { id: "other", name: "Other" } },
      start + 8000,
    ),
  ).toBe(false);
});
