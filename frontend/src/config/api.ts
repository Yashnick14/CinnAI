export const API = {
  mode: process.env.EXPO_PUBLIC_GRADING_MODE === "api" ? "api" : "mock",
  baseUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
  // Allow Azure scale-to-zero startup before inference. Validation allows twice this.
  timeoutMs: 90_000,
} as const;
