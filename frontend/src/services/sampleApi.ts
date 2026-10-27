import { API } from "../config/api";
import { fetch as streamingFetch } from "expo/fetch";
import {
  readValidationStream,
  type ValidationProgress,
} from "./validationStream";
import { visualEndpoint } from "./visualApi";
import { uploadPhoto } from "./uploadPhoto";
import { validatePhoto } from "../storage/photos";
import { DecisionSchema, type SampleResult } from "../types/decision";
import type { VisualRequest } from "../types/visual";
export async function validateSample(
  request: VisualRequest,
  signal: AbortSignal,
  onProgress?: (event: ValidationProgress) => void,
): Promise<SampleResult> {
  if (!request.captureGeometry)
    throw new Error("Retake the sample using the capture guides.");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, API.timeoutMs * 2);
  try {
    const endpoint = visualEndpoint().replace(
      /\/predict-visual$/,
      "/validate-sample?live=true",
    );
    const imageUri = await validatePhoto(request.imageUri);
    const photo = await uploadPhoto(imageUri);
    const body = new FormData();
    body.append(
      "image",
      photo,
      photo.type === "image/png" ? "sample.png" : "sample.jpg",
    );
    body.append("capture_geometry", JSON.stringify(request.captureGeometry));
    if (controller.signal.aborted)
      throw new Error("Sample validation cancelled or timed out.");
    let response: Response;
    try {
      response = await streamingFetch(endpoint, {
        method: "POST",
        body,
        signal: controller.signal,
      });
    } catch {
      throw new Error(
        "Cannot complete sample validation. Check the backend and Wi-Fi, then retry. No grade has been assigned.",
      );
    }
    if (!response.ok)
      throw new Error(
        `Sample validation unavailable (HTTP ${response.status}). No grade has been assigned.`,
      );
    if (!response.body)
      throw new Error(
        "Live validation is unavailable. Restart the backend and retry.",
      );
    const parsed = DecisionSchema.safeParse(
      await readValidationStream(response.body.getReader(), onProgress),
    );
    if (!parsed.success)
      throw new Error(
        "Invalid validation response. No grade has been assigned.",
      );
    return {
      ...parsed.data,
      imageUri,
      sessionId: request.sessionId,
      moisture: request.moisture ? { ...request.moisture } : undefined,
    };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
