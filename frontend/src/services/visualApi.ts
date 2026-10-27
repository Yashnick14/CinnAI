import { API } from "../config/api";
import { validatePhoto } from "../storage/photos";
import {
  VisualResponseSchema,
  type VisualRequest,
  type VisualResult,
} from "../types/visual";
import { uploadPhoto } from "./uploadPhoto";

export type VisualErrorKind =
  | "no_quill"
  | "unusable_features"
  | "backend_unavailable"
  | "invalid_response"
  | "invalid_photo"
  | "cancelled"
  | "configuration"
  | "request_failed";
export class VisualApiError extends Error {
  constructor(
    public readonly kind: VisualErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "VisualApiError";
  }
}

export function visualEndpoint() {
  let url: URL;
  try {
    url = new URL(API.baseUrl);
  } catch {
    throw new VisualApiError(
      "configuration",
      "Set EXPO_PUBLIC_API_URL to your laptop's LAN address, then restart Expo.",
    );
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !/^https?:$/.test(url.protocol) ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^127\./.test(host) ||
    ["::1", "0.0.0.0", "::"].includes(host) ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  )
    throw new VisualApiError(
      "configuration",
      "Use the backend's LAN base URL, for example http://192.168.1.250:8000. Localhost cannot reach your laptop from an iPhone.",
    );
  return `${url.origin}/predict-visual`;
}

export async function predictVisual(
  request: VisualRequest,
  signal: AbortSignal,
): Promise<VisualResult> {
  const endpoint = visualEndpoint();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API.timeoutMs);
  try {
    if (controller.signal.aborted)
      throw new VisualApiError("cancelled", "Analysis cancelled.");
    let imageUri: string;
    let photo: Blob;
    try {
      imageUri = await validatePhoto(request.imageUri);
      photo = await uploadPhoto(imageUri);
    } catch {
      throw new VisualApiError(
        "invalid_photo",
        "The captured photo could not be read. Return to the camera and take another photo.",
      );
    }
    if (controller.signal.aborted)
      throw new VisualApiError("cancelled", "Analysis cancelled.");
    const body = new FormData();
    body.append(
      "image",
      photo,
      photo.type === "image/png" ? "cinnamon.png" : "cinnamon.jpg",
    );
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        body,
        signal: controller.signal,
      });
    } catch {
      throw new VisualApiError(
        "backend_unavailable",
        "Cannot reach the visual backend. Keep FastAPI running and check your laptop's LAN IP and that both devices use the same Wi-Fi.",
      );
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      if (!response.ok)
        throw new VisualApiError(
          "backend_unavailable",
          `The visual backend returned HTTP ${response.status}. Check the server and retry.`,
        );
      throw new VisualApiError(
        "invalid_response",
        "The backend returned an invalid visual prediction response. Check the API version and retry.",
      );
    }
    if (!response.ok) {
      const detail =
        raw &&
        typeof raw === "object" &&
        "detail" in raw &&
        typeof raw.detail === "string"
          ? raw.detail
          : "";
      if (
        response.status === 422 &&
        /no usable|foreground feature sets/i.test(detail)
      )
        throw new VisualApiError(
          "unusable_features",
          "YOLO found quill detections, but the foreground extraction could not produce usable visual features. Backend detail: " +
            detail,
        );
      if (response.status === 422 && /no quill/i.test(detail))
        throw new VisualApiError(
          "no_quill",
          "YOLO did not return a quill detection at the validated confidence threshold. Backend detail: " +
            detail,
        );
      if (response.status === 404 || response.status >= 500)
        throw new VisualApiError(
          "backend_unavailable",
          response.status === 404
            ? "The /predict-visual endpoint was not found. Restart the visual-only FastAPI backend."
            : "The visual backend is unavailable. Check its terminal for model or inference errors, then retry.",
        );
      throw new VisualApiError(
        "request_failed",
        detail ||
          `The image request was rejected (HTTP ${response.status}). Take another photo and retry.`,
      );
    }
    const parsed = VisualResponseSchema.safeParse(raw);
    if (!parsed.success)
      throw new VisualApiError(
        "invalid_response",
        "The backend returned an invalid visual prediction response. Expected all eight grade probabilities and matching confidence.",
      );
    const result = parsed.data;
    if (result.detected_quills === 0)
      throw new VisualApiError(
        "no_quill",
        "No quill was detected. Return to the camera and take another photo.",
      );
    return {
      imageUri,
      detectedQuills: result.detected_quills,
      visualPrediction: result.visual_prediction,
      visualConfidence: result.visual_confidence,
      probabilities: result.probabilities,
    };
  } catch (error) {
    if (signal.aborted)
      throw new VisualApiError("cancelled", "Analysis cancelled.");
    if (timedOut)
      throw new VisualApiError(
        "backend_unavailable",
        "The visual request timed out. Check the backend and Wi-Fi, then retry.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
