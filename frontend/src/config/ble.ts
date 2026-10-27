// PROVISIONAL: empirical ADC cutoff, not an ADC-to-moisture calibration.
export const ADC_THRESHOLD = 2842;
export const BLE = {
  mode:
    process.env.EXPO_PUBLIC_SENSOR_MODE === "wifi"
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
