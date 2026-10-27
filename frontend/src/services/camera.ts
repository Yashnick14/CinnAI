import type { CameraView } from "expo-camera";
import { preservePhoto } from "../storage/photos";
import { saveCaptureGeometry } from "../storage/photos";
import { captureGeometry, type Viewport } from "../config/captureGuides";
export async function capturePhoto(camera: CameraView | null): Promise<string> {
  return (await capturePhotoDetails(camera)).imageUri;
}
export async function capturePhotoDetails(
  camera: CameraView | null,
  viewport?: Viewport,
) {
  if (!camera)
    throw new Error("The camera is unavailable. Please restart the camera.");
  let photo;
  try {
    photo = await camera.takePictureAsync({
      quality: 0.85,
      skipProcessing: false,
      exif: true,
    });
  } catch {
    throw new Error(
      "Could not capture the photo. Hold the phone steady and try again.",
    );
  }
  if (!photo?.uri || !photo.width || !photo.height)
    throw new Error("No valid photo was captured. Please try again.");
  const imageUri = await preservePhoto(photo.uri);
  const geometry = viewport
    ? captureGeometry(viewport, photo.width, photo.height)
    : undefined;
  if (geometry) await saveCaptureGeometry(imageUri, geometry);
  return { imageUri, captureGeometry: geometry };
}
