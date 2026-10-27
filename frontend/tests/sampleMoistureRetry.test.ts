import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), parse: vi.fn() }));
vi.mock("expo/fetch", () => ({ fetch: mocks.fetch }));
vi.mock("../src/services/visualApi", () => ({
  visualEndpoint: () => "http://192.168.10.149:8000/predict-visual",
}));
vi.mock("../src/storage/photos", () => ({
  validatePhoto: async (uri: string) => uri,
}));
vi.mock("../src/services/uploadPhoto", () => ({
  uploadPhoto: async () => new Blob(["image"], { type: "image/jpeg" }),
}));
vi.mock("../src/services/validationStream", () => ({
  readValidationStream: async () => ({}),
}));
vi.mock("../src/types/decision", () => ({
  DecisionSchema: { safeParse: mocks.parse },
}));
import { validateSample } from "../src/services/sampleApi";
import type { VisualRequest } from "../src/types/visual";
import { snapshotMoisture } from "../src/services/sessionMoisture";
it("retry retains the captured sample reading instead of reading the live sensor", async () => {
  const moisture = snapshotMoisture({
    state: "connected",
    isMock: false,
    device: null,
    devices: [],
    medianAdc: 2910,
    moisturePercent: null,
    updatedAt: new Date().toISOString(),
    error: null,
  });
  const request = {
    imageUri: "file:///sample.jpg",
    sessionId: "sample-1",
    captureGeometry: {},
    moisture,
  } as VisualRequest;
  mocks.fetch
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ok: true, body: { getReader: () => ({}) } });
  mocks.parse.mockReturnValue({
    success: true,
    data: { status: "VALID", final_grade: "M4" },
  });
  await expect(
    validateSample(request, new AbortController().signal),
  ).rejects.toThrow("Cannot complete");
  const result = await validateSample(request, new AbortController().signal);
  expect(result.moisture).toEqual(moisture);
  expect(result.moisture).not.toBe(moisture);
  expect(result.sessionId).toBe("sample-1");
});
