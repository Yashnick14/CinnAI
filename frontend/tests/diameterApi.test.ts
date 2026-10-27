import { beforeEach, expect, it, vi } from "vitest";
import { captureGeometry } from "../src/config/captureGuides";
vi.mock("../src/services/visualApi", () => ({
  visualEndpoint: () => "http://192.168.1.250:8000/predict-visual",
}));
vi.mock("../src/storage/photos", () => ({
  validatePhoto: async (uri: string) => uri,
}));
vi.mock("../src/services/uploadPhoto", () => ({
  uploadPhoto: async () => new Blob(["photo"], { type: "image/jpeg" }),
}));
import { measureDiameter } from "../src/services/diameterApi";
const request = {
  imageUri: "file://photo.jpg",
  captureGeometry: captureGeometry({ width: 300, height: 400 }, 1200, 1600),
};
const result = {
  coin_diameter_px: 250,
  pixels_per_mm: 250 / 26.4,
  quill_width_px: 150,
  quill_diameter_mm: 15.84,
  diameter_grade: "C4",
  valid_rows: 100,
  diagnostic_overlay: "data:image/png;base64,cG5n",
};
beforeEach(() => vi.unstubAllGlobals());
it("sends the captured photo and geometry to the separate endpoint", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await measureDiameter(request, new AbortController().signal)).toEqual(
    result,
  );
  const [url, options] = fetcher.mock.calls[0]!;
  expect(url).toBe("http://192.168.1.250:8000/measure-diameter");
  expect(options.body.get("image")).toBeInstanceOf(Blob);
  expect(JSON.parse(options.body.get("capture_geometry"))).toEqual(
    request.captureGeometry,
  );
  expect(options.headers).toBeUndefined();
});
it("preserves retake guidance", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ detail: "Coin is clipped. Retake." }), {
          status: 422,
        }),
      ),
  );
  await expect(
    measureDiameter(request, new AbortController().signal),
  ).rejects.toThrow("Coin is clipped");
});
it("rejects invalid responses and missing geometry", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
  );
  await expect(
    measureDiameter(request, new AbortController().signal),
  ).rejects.toThrow("Invalid diameter");
  await expect(
    measureDiameter(
      { imageUri: request.imageUri },
      new AbortController().signal,
    ),
  ).rejects.toThrow("No capture guides");
});
it("does not upload after cancellation", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController();
  controller.abort();
  await expect(measureDiameter(request, controller.signal)).rejects.toThrow(
    "cancelled",
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it("preserves backend raw/calibrated fields without subtracting again", async () => {
  const payload = { ...result, raw_diameter_mm: 19, calibrated_diameter_mm: 17.5,
    quill_diameter_mm: 17.5, diameter_grade: "M5" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
  expect(await measureDiameter(request, new AbortController().signal)).toEqual(payload);
});

it("accepts a backend diameter clamped at zero", async () => {
  const payload = { ...result, raw_diameter_mm: 1, calibrated_diameter_mm: 0,
    quill_diameter_mm: 0, diameter_grade: "Alba" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
  expect(await measureDiameter(request, new AbortController().signal)).toEqual(payload);
});
