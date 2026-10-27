export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Viewport {
  width: number;
  height: number;
}
export interface CaptureGeometry {
  version: 1;
  mapping: "ios-preview-cropped";
  image_width: number;
  image_height: number;
  preview_width: number;
  preview_height: number;
  coin: Rect;
  quill: Rect;
}
// Relative to CameraView only, never the whole screen. Coin is square in pixels.
export function captureGuides(view: Viewport) {
  const side = Math.min(view.width * 0.32, view.height * 0.3);
  return {
    coin: {
      x: 0.07,
      y: 0.54,
      width: side / view.width,
      height: side / view.height,
    },
    quill: { x: 0.55, y: 0.08, width: 0.36, height: 0.84 },
  };
}
export function captureGeometry(
  view: Viewport,
  width: number,
  height: number,
): CaptureGeometry {
  if (
    ![view.width, view.height, width, height].every(Number.isFinite) ||
    Math.min(view.width, view.height, width, height) <= 0 ||
    Math.abs(width / height / (view.width / view.height) - 1) > 0.02
  )
    throw new Error(
      "Preview and captured image dimensions differ. Restart the camera and retake.",
    );
  return {
    version: 1,
    mapping: "ios-preview-cropped",
    image_width: width,
    image_height: height,
    preview_width: view.width,
    preview_height: view.height,
    ...captureGuides(view),
  };
}
