export const SENSOR_WIFI = {
  baseUrl: (process.env.EXPO_PUBLIC_SENSOR_WIFI_URL ?? "").replace(/\/+$/, ""),
  pollMs: 2000,
  timeoutMs: 5000,
  maxSampleAgeMs: 10000,
} as const;
