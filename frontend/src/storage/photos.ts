import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import type { CaptureGeometry } from "../config/captureGuides";

/** Persist capture-guide metadata alongside the captured photo when supported by the platform. */
export async function saveCaptureGeometry(uri: string, geometry: CaptureGeometry) {
  const photo = await validatePhoto(uri);
  const sidecar = new File(photo.replace(/\.jpg$/, ".geometry.json"));
  sidecar.write(JSON.stringify(geometry, null, 2));
}

/** Resolve the application's persistent photo directory. */
const folder = () => new Directory(Paths.document, "grading-images");

/** Resolve the stored photo reference to a URI usable on this platform. */
export function resolvePhotoUri(uri: string): string {
  const match = uri?.match(/\/grading-images\/([a-zA-Z0-9-]+\.jpg)$/);
  return match ? new File(folder(), match[1]!).uri : uri;
}

/** Check that the captured image is still available before analysis or saving. */
export async function validatePhoto(uri: string): Promise<string> {
  if (!uri?.trim() || !uri.startsWith("file://"))
    throw new Error("The captured photo is missing. Please retake it.");
  const resolved = resolvePhotoUri(uri);
  const file = new File(resolved);
  if (!file.exists || !file.size)
    throw new Error("This photo is unavailable or empty. Please retake it.");
  return resolved;
}

/** Keep a persistent photo reference appropriate to the current platform. */
export async function preservePhoto(uri: string): Promise<string> {
  const source = await validatePhoto(uri);
  const directory = folder();
  directory.create({ idempotent: true, intermediates: true });
  if (/\/grading-images\/[a-zA-Z0-9-]+\.jpg$/.test(source)) return source;
  const target = new File(directory, `${randomUUID()}.jpg`);
  try {
    new File(source).copy(target);
    return await validatePhoto(target.uri);
  } catch {
    throw new Error(
      "Could not store the photo on this device. Check free storage and retake it.",
    );
  }
}
