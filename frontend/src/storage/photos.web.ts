/** Resolve the stored photo reference to a URI usable on this platform. */
export function resolvePhotoUri(uri: string): string {
  return uri;
}

/** Leave filesystem geometry persistence disabled in the browser implementation. */
export async function saveCaptureGeometry() {
  throw new Error("Controlled diameter capture currently requires the iPhone camera.");
}

/** Check that the captured image is still available before analysis or saving. */
export async function validatePhoto(uri: string): Promise<string> {
  if (!uri?.trim()) throw new Error("The photo is missing. Please retake it.");
  const response = await fetch(uri);
  if (!response.ok || !(await response.blob()).size)
    throw new Error("The photo is unavailable. Please retake it.");
  return uri;
}

/** Keep a persistent photo reference appropriate to the current platform. */
export async function preservePhoto(uri: string): Promise<string> {
  await validatePhoto(uri);
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not store photo."));
    reader.onerror = () => reject(new Error("Could not store photo."));
    reader.readAsDataURL(blob);
  });
}
