export function resolvePhotoUri(uri: string): string {
  return uri;
}
export async function saveCaptureGeometry() {
  throw new Error(
    "Controlled diameter capture currently requires the iPhone camera.",
  );
}
export async function validatePhoto(uri: string): Promise<string> {
  if (!uri?.trim()) throw new Error("The photo is missing. Please retake it.");
  const response = await fetch(uri);
  if (!response.ok || !(await response.blob()).size)
    throw new Error("The photo is unavailable. Please retake it.");
  return uri;
}
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
