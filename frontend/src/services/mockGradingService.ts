import { randomUUID } from "expo-crypto";
import { createMockResult } from "./mockGrading";
import { gradeViaApi } from "./api";
import { API } from "../config/api";
import { validatePhoto } from "../storage/photos";
import type { GradeRequest } from "../types/grading";
// Future backend upload belongs in the API service. This phase always uses fixtures.
export async function gradeCapturedPhoto(
  request: GradeRequest,
  signal?: AbortSignal,
) {
  const imageUri = await validatePhoto(request.imageUri);
  if (signal?.aborted) throw new Error("Cancelled");
  const prepared = { ...request, imageUri, moisturePercent: 11.8 };
  if (API.mode === "api") {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, API.timeoutMs);
    try {
      return await gradeViaApi(prepared, controller.signal);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  }
  const result = createMockResult(
    prepared,
    randomUUID(),
    new Date().toISOString(),
  );
  result.warnings.push(
    "Moisture is a fixed simulated value, not a sensor reading. No image processing was performed.",
  );
  return result;
}
