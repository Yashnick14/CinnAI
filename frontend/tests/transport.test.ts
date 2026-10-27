import { afterEach, beforeEach, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({
  mode: "api",
  baseUrl: "https://grading.example.test",
  timeoutMs: 100,
}));
vi.mock("../src/config/api", () => ({ API: config }));
vi.mock("expo-file-system", () => ({
  File: class extends Blob {
    constructor(readonly uri: string) {
      super([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
    }
  },
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "7d99e15a-8743-4e3d-903c-d3c6952191bb",
}));
vi.mock("../src/storage/photos", () => ({
  validatePhoto: async (uri: string) => uri,
}));
import { gradeSample } from "../src/services/grading";
import { gradeViaApi } from "../src/services/api";
import { gradeCapturedPhoto } from "../src/services/mockGradingService";
const request = {
  imageUri: "file:///capture.jpg",
  moisturePercent: null,
  scenario: "accepted" as const,
};
const fetchMock = vi.fn();
beforeEach(() => {
  config.mode = "api";
  config.timeoutMs = 100;
  config.baseUrl = "https://grading.example.test";
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
});

it("does not fall back to a demo response when the network fails", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  await expect(
    gradeSample(request, new AbortController().signal),
  ).rejects.toThrow("Cannot reach the backend");
});

it("requires a configured URL in API mode", async () => {
  config.baseUrl = "";
  await expect(
    gradeViaApi(request, new AbortController().signal),
  ).rejects.toThrow("EXPO_PUBLIC_API_URL");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("surfaces upload validation errors", async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({ detail: "Image exceeds the upload size limit." }),
      { status: 413 },
    ),
  );
  await expect(
    gradeSample(request, new AbortController().signal),
  ).rejects.toThrow("upload size limit");
});

it("rejects an incompatible success response", async () => {
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  await expect(
    gradeSample(request, new AbortController().signal),
  ).rejects.toThrow("incompatible grading response");
});

it("omits unavailable moisture and lets fetch set the multipart boundary", async () => {
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  await gradeSample(request, new AbortController().signal).catch(() => {});
  const [url, options] = fetchMock.mock.calls[0]!;
  expect(url).toBe("https://grading.example.test/api/v1/grade");
  expect(options.body.has("moisture_percent")).toBe(false);
  expect(options.body.has("image")).toBe(true);
  const image = options.body.get("image");
  expect(image).toBeInstanceOf(Blob);
  expect(image.name).toBe("cinnamon.jpg");
  expect(image.type).toBe("image/jpeg");
  expect(await image.arrayBuffer()).toEqual(
    new Uint8Array([0xff, 0xd8, 0xff]).buffer,
  );
  expect(options.headers).toBeUndefined();
});

function abortableFetch() {
  fetchMock.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        if (signal.aborted) {
          reject(new Error("aborted"));
          return;
        }
        signal.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      }),
  );
}
it("times out a pending backend request", async () => {
  vi.useFakeTimers();
  abortableFetch();
  const assertion = expect(
    gradeSample(request, new AbortController().signal),
  ).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(101);
  await assertion;
});

it("cancels a pending request when leaving analysis", async () => {
  abortableFetch();
  const controller = new AbortController();
  const assertion = expect(
    gradeSample(request, controller.signal),
  ).rejects.toThrow("cancelled");
  controller.abort();
  await assertion;
});

it("returns an explicit local mock without contacting the backend", async () => {
  config.mode = "mock";
  config.timeoutMs = 30000;
  vi.useFakeTimers();
  const pending = gradeSample(request, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(2400);
  await expect(pending).resolves.toMatchObject({
    isMock: true,
    source: "local_mock",
    moistureStatus: "UNAVAILABLE",
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("uses the explicit mobile mock fixture with fixed demo moisture", async () => {
  config.mode = "mock";
  await expect(
    gradeCapturedPhoto(request, new AbortController().signal),
  ).resolves.toMatchObject({
    source: "local_mock",
    moisturePercent: 11.8,
    moistureStatus: "PASS",
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("uploads the validated capture through the API workflow", async () => {
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  await gradeCapturedPhoto(request, new AbortController().signal).catch(() => {});
  const [, options] = fetchMock.mock.calls[0]!;
  expect(options.body.get("moisture_percent")).toBe("11.8");
  expect(options.body.has("image")).toBe(true);
});
