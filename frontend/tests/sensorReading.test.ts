import { expect, it } from "vitest";
import { encode } from "base-64";
import { ADC_THRESHOLD } from "../src/config/ble";
import { decodeSensorReading } from "../src/services/sensorReading";

it.each([
  ["2903", 2903, "PASS"],
  ["2842", 2842, "PASS"],
  ["2841", 2841, "FAIL"],
  ["0", 0, "FAIL"],
  ["4095", 4095, "PASS"],
  [" 2903\r\n", 2903, "PASS"],
])("decodes %s as ADC with provisional status", (text, adc, status) => {
  expect(ADC_THRESHOLD).toBe(2842);
  const reading = decodeSensorReading(encode(String(text)));
  expect(reading).toEqual({ medianAdc: adc, provisionalStatus: status });
  expect(reading).not.toHaveProperty("moisturePercent");
});
it.each([
  "",
  "-1",
  "4096",
  "2903.5",
  "29abc",
  "NaN",
  "14%",
  "2903\u0000",
  "٢٩٠٣",
  "12345",
])("rejects invalid ADC text %s", (text) => {
  const utf8Base64 = Buffer.from(text, "utf8").toString("base64");
  expect(() => decodeSensorReading(utf8Base64)).toThrow("Invalid BLE value");
});
it.each([null, "!!!!", "MjkwMw", " "])(
  "rejects malformed base64 %s",
  (value) => {
    expect(() => decodeSensorReading(value)).toThrow("Invalid BLE value");
  },
);
