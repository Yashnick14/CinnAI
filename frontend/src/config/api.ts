export const API = {
  mode: process.env.EXPO_PUBLIC_GRADING_MODE === "api" ? "api" : "mock",
  baseUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
  timeoutMs: 30_000,
} as const;
