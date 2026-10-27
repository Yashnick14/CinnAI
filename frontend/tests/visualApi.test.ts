import { afterEach, beforeEach, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({
  mode: "api",
  baseUrl: "http://192.168.1.250:8000",
  timeoutMs: 100,
}));
vi.mock("../src/config/api", () => ({ API: config }));
vi.mock("../src/storage/photos", () => ({
  validatePhoto: vi.fn(async (uri: string) => uri),
}));
vi.mock("../src/services/uploadPhoto", () => ({
  uploadPhoto: vi.fn(
    async () =>
      new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }),
  ),
}));
import { predictVisual, visualEndpoint } from "../src/services/visualApi";
import { validatePhoto } from "../src/storage/photos";
import { uploadPhoto } from "../src/services/uploadPhoto";
const payload = {
  detected_quills: 1,
  visual_prediction: "C4",
  visual_confidence: 0.34,
  probabilities: {
    Alba: 0.096,
    C4: 0.34,
    C5: 0.31,
    "C5 Special": 0.144,
    H1: 0.004,
    H2: 0.082,
    M4: 0.012,
    M5: 0.012,
  },
};
const request = { imageUri: "file:///saved-cinnamon.jpg" };
const fetcher = vi.fn();
beforeEach(() => {
  config.baseUrl = "http://192.168.1.250:8000";
  config.mode = "api";
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue(new Response(JSON.stringify(payload)));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetcher.mockReset();
  vi.mocked(validatePhoto).mockClear();
  vi.mocked(uploadPhoto).mockClear();
});

it("uploads the existing photo as a file to the visual endpoint with no hybrid fields", async () => {
  const result = await predictVisual(request, new AbortController().signal);
  const [url, options] = fetcher.mock.calls[0]!;
  expect(url).toBe("http://192.168.1.250:8000/predict-visual");
  expect(options.method).toBe("POST");
  expect([...options.body.keys()]).toEqual(["image"]);
  const image = options.body.get("image");
  expect(image).toBeInstanceOf(Blob);
  expect(image.name).toBe("cinnamon.jpg");
  expect(image.type).toBe("image/jpeg");
  expect(options.headers).toBeUndefined();
  expect(validatePhoto).toHaveBeenCalledWith(request.imageUri);
  expect(uploadPhoto).toHaveBeenCalledWith(request.imageUri);
  expect(result).toEqual({
    imageUri: request.imageUri,
    detectedQuills: 1,
    visualPrediction: "C4",
    visualConfidence: 0.34,
    probabilities: payload.probabilities,
  });
});
it("uses visual inference even when an old demo environment flag remains", async () => {
  config.mode = "mock";
  expect(
    (await predictVisual(request, new AbortController().signal))
      .visualPrediction,
  ).toBe("C4");
  expect(fetcher).toHaveBeenCalledOnce();
});
it.each([
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://[::1]:8000",
  "http://0.0.0.0:8000",
  "",
  "ftp://192.168.1.250",
  "http://192.168.1.250:8000/predict-visual",
])("rejects an unsuitable phone base URL %s", async (url) => {
  config.baseUrl = url;
  await expect(
    predictVisual(request, new AbortController().signal),
  ).rejects.toMatchObject({ kind: "configuration" });
  expect(fetcher).not.toHaveBeenCalled();
});
it("supports a trailing slash in a configured base URL", () => {
  config.baseUrl = "http://192.168.1.250:8000/";
  expect(visualEndpoint()).toBe("http://192.168.1.250:8000/predict-visual");
});
it.each([
  ["No quill detected in the uploaded image.", "no_quill"],
  [
    "Quills were detected, but no usable foreground feature sets remained.",
    "unusable_features",
  ],
])(
  "distinguishes detection failure from foreground feature failure",
  async (detail, kind) => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ detail }), { status: 422 }),
    );
    await expect(
      predictVisual(request, new AbortController().signal),
    ).rejects.toMatchObject({ kind, message: expect.stringContaining(detail) });
  },
);
it.each([404, 500, 503])("handles backend HTTP %d", async (status) => {
  fetcher.mockResolvedValue(
    new Response(JSON.stringify({ detail: "unavailable" }), { status }),
  );
  await expect(
    predictVisual(request, new AbortController().signal),
  ).rejects.toMatchObject({ kind: "backend_unavailable" });
});
it.each([
  {},
  { ...payload, detected_quills: -1 },
  { ...payload, detected_quills: 1.5 },
  { ...payload, visual_prediction: "H3" },
  { ...payload, visual_confidence: 0.99 },
  { ...payload, visual_prediction: "C5", visual_confidence: 0.31 },
  { ...payload, probabilities: { C4: 1 } },
  { ...payload, probabilities: { ...payload.probabilities, Alba: -0.01 } },
  { ...payload, probabilities: { ...payload.probabilities, Alba: 0.5 } },
])(
  "rejects invalid predictions and inconsistent probability distributions",
  async (raw) => {
    fetcher.mockResolvedValue(new Response(JSON.stringify(raw)));
    await expect(
      predictVisual(request, new AbortController().signal),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  },
);
it("handles a non-JSON successful response", async () => {
  fetcher.mockResolvedValue(new Response("<html>unexpected</html>"));
  await expect(
    predictVisual(request, new AbortController().signal),
  ).rejects.toMatchObject({ kind: "invalid_response" });
});
it("treats zero detections as no-quill rather than displaying a result", async () => {
  fetcher.mockResolvedValue(
    new Response(JSON.stringify({ ...payload, detected_quills: 0 })),
  );
  await expect(
    predictVisual(request, new AbortController().signal),
  ).rejects.toMatchObject({ kind: "no_quill" });
});
it("never falls back to mock predictions on a network failure", async () => {
  fetcher.mockRejectedValue(new TypeError("Network request failed"));
  await expect(
    predictVisual(request, new AbortController().signal),
  ).rejects.toMatchObject({ kind: "backend_unavailable" });
});
function pendingFetch() {
  fetcher.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("request cancelled")),
          { once: true },
        );
      }),
  );
}
it("times out a stalled upload/inference request", async () => {
  vi.useFakeTimers();
  pendingFetch();
  const assertion = expect(
    predictVisual(request, new AbortController().signal),
  ).rejects.toMatchObject({
    kind: "backend_unavailable",
    message: expect.stringContaining("timed out"),
  });
  await vi.advanceTimersByTimeAsync(101);
  await assertion;
});
it("cancels an in-flight request when leaving the screen", async () => {
  vi.useFakeTimers();
  pendingFetch();
  const controller = new AbortController();
  const assertion = expect(
    predictVisual(request, controller.signal),
  ).rejects.toMatchObject({ kind: "cancelled" });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await assertion;
});
it("does not upload an already cancelled request", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(predictVisual(request, controller.signal)).rejects.toMatchObject(
    { kind: "cancelled" },
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it("reports an unreadable photo without contacting the backend", async () => {
  vi.mocked(validatePhoto).mockRejectedValueOnce(new Error("Missing photo"));
  await expect(
    predictVisual(request, new AbortController().signal),
  ).rejects.toMatchObject({ kind: "invalid_photo" });
  expect(fetcher).not.toHaveBeenCalled();
});
