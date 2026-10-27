import { API } from "../config/api";
import { visualEndpoint } from "./visualApi";
import { uploadPhoto } from "./uploadPhoto";
import { validatePhoto } from "../storage/photos";
import { DiameterSchema } from "../types/diameter";
import type { VisualRequest } from "../types/visual";

export async function measureDiameter(
  request: VisualRequest,
  signal: AbortSignal,
) {
  if (!request.captureGeometry)
    throw new Error(
      "No capture guides were saved. Retake using the fixed guides.",
    );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, API.timeoutMs);
  try {
    const endpoint = visualEndpoint().replace(
      /\/predict-visual$/,
      "/measure-diameter",
    );
    const photo = await uploadPhoto(await validatePhoto(request.imageUri));
    const body = new FormData();
    body.append(
      "image",
      photo,
      photo.type === "image/png" ? "capture.png" : "capture.jpg",
    );
    body.append("capture_geometry", JSON.stringify(request.captureGeometry));
    if (controller.signal.aborted)
      throw new Error("Diameter request cancelled or timed out.");
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        body,
        signal: controller.signal,
      });
    } catch {
      throw new Error(
        "Diameter backend unavailable or request timed out. Check Wi-Fi and the backend.",
      );
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new Error("Invalid diameter response from backend.");
    }
    if (!response.ok) {
      const detail =
        raw &&
        typeof raw === "object" &&
        "detail" in raw &&
        typeof raw.detail === "string"
          ? raw.detail
          : "Diameter measurement unavailable. Retake with both objects inside their guides.";
      throw new Error(detail);
    }
    const parsed = DiameterSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error("Invalid diameter response from backend.");
    return parsed.data;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
