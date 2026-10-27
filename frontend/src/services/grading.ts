import * as Crypto from "expo-crypto";
import { API } from "../config/api";
import type { GradeRequest } from "../types/grading";
import { gradeViaApi } from "./api";
import { createMockResult } from "./mockGrading";

export async function gradeSample(request: GradeRequest, signal: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel);
  if (signal.aborted) controller.abort();
  const timer = setTimeout(cancel, API.timeoutMs);
  try {
    if (API.mode === "api")
      return await gradeViaApi(request, controller.signal);
    await new Promise<void>((resolve, reject) => {
      if (controller.signal.aborted) {
        reject(new Error("Analysis cancelled."));
        return;
      }
      const abort = () => {
        clearTimeout(wait);
        reject(new Error("Analysis cancelled."));
      };
      const wait = setTimeout(() => {
        controller.signal.removeEventListener("abort", abort);
        resolve();
      }, 2400);
      controller.signal.addEventListener("abort", abort, { once: true });
    });
    return createMockResult(
      request,
      Crypto.randomUUID(),
      new Date().toISOString(),
    );
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error(
        signal.aborted
          ? "Analysis cancelled."
          : "The request timed out. Check the backend and try again.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
