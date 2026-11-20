// Empirical screening only; not a calibrated 14% moisture conversion.
export const ADC_THRESHOLD = 1711;
export const ADC_UNTOUCHED_THRESHOLD = 2850;

/** Classify contact-screened ADC without estimating a moisture percentage. */
export function adcScreeningStatus(adc: number): "PASS" | "FAIL" | null {
  return adc >= ADC_UNTOUCHED_THRESHOLD ? null : adc >= ADC_THRESHOLD ? "PASS" : "FAIL";
}
export const BLE = {
  mode:
    process.env.EXPO_PUBLIC_SENSOR_MODE === "cloud"
      ? "cloud"
      : process.env.EXPO_PUBLIC_SENSOR_MODE === "wifi"
        ? "wifi"
        : process.env.EXPO_PUBLIC_SENSOR_MODE === "real"
          ? "real"
          : "mock",
  serviceUuid: "7f510001-8c3d-4b89-a9e7-71c3a0000001",
  moistureCharacteristicUuid: "7f510002-8c3d-4b89-a9e7-71c3a0000001",
  expectedDeviceName: "CinnamonGradingSensor",
  scanTimeoutMs: 10000,
  connectTimeoutMs: 10000,
  stateTimeoutMs: 5000,
  adcMax: 4095,
  readingFreshnessMs: 30000,
} as const;
