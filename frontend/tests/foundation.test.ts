// These pure mapping tests do not access the native filesystem.
vi.mock("expo-file-system", () => ({ File: class extends Blob {} }));
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockResult } from "../src/services/mockGrading";
import { mapApiResult } from "../src/services/api";
import { MockSensorService, freshMoisture } from "../src/services/ble";
import { createHistoryRepository } from "../src/storage/historyRepository";
import { GradingResultSchema, type DemoScenario } from "../src/types/grading";
import { APP } from "../src/config/app";
const id = "7d99e15a-8743-4e3d-903c-d3c6952191bb";
const timestamp = "2026-10-11T10:00:00.000Z";
const result = (
  scenario: DemoScenario = "accepted",
  moisturePercent: number | null = 11.8,
) =>
  createMockResult(
    { imageUri: "file:///capture.jpg", moisturePercent, scenario },
    id,
    timestamp,
  );

afterEach(() => vi.useRealTimers());

describe("explicit demo fixtures", () => {
  it.each([
    "accepted",
    "moisture_fail",
    "manual_review",
    "measurement_error",
    "no_quill",
  ] as const)("%s satisfies the contract", (scenario) => {
    const r = GradingResultSchema.parse(result(scenario));
    expect(r.isMock).toBe(true);
    expect(r.warnings[0]).toContain("DEMO");
  });
  it("retains grade on moisture failure and respects 14% boundary", () => {
    expect(result("accepted", 13.99).moistureStatus).toBe("PASS");
    expect(result("accepted", 14).finalStatus).toBe("MOISTURE_NON_COMPLIANT");
    expect(result("accepted", 14).finalGrade).toBe("M4");
  });
  it("does not silently create missing moisture", () => {
    expect(result("accepted", null).moisturePercent).toBeNull();
    expect(result("accepted", null).finalStatus).toBe("MANUAL_REVIEW");
  });
  it("does not assign a grade for conflicts or measurement failure", () => {
    expect(result("manual_review").finalGrade).toBeNull();
    expect(result("measurement_error").diameterMm).toBeNull();
    expect(result("no_quill").visualPrediction).toBeNull();
  });
  it("rejects unsupported grades", () => {
    expect(() =>
      GradingResultSchema.parse({ ...result(), finalGrade: "C3" }),
    ).toThrow();
  });
  it("maps all API fields and validates the response", () => {
    const r = result();
    const api = {
      id,
      timestamp,
      is_mock: true,
      detected_quill_count: r.detectedQuillCount,
      visual_prediction: r.visualPrediction,
      visual_confidence: r.visualConfidence,
      visual_probabilities: r.visualProbabilities,
      diameter_mm: r.diameterMm,
      diameter_candidates: r.diameterCandidates,
      candidate_probabilities: r.candidateProbabilities,
      final_candidate_confidence: r.finalCandidateConfidence,
      moisture_percent: r.moisturePercent,
      moisture_status: r.moistureStatus,
      final_grade: r.finalGrade,
      final_status: r.finalStatus,
      warnings: r.warnings,
    };
    expect(mapApiResult(api, r.imageUri!)).toEqual({
      ...r,
      source: "api_mock",
    });
    expect(() => mapApiResult({ ...api, visual_confidence: 4 }, "")).toThrow();
  });
});

describe("sensor lifecycle", () => {
  it("scans, connects, receives readings, disconnects and reconnects", async () => {
    vi.useFakeTimers();
    const sensor = new MockSensorService();
    const scan = sensor.scan();
    expect(sensor.getSnapshot().state).toBe("scanning");
    await vi.advanceTimersByTimeAsync(650);
    await scan;
    expect(sensor.getSnapshot().devices).toHaveLength(1);
    const connect = sensor.connect("demo-esp32");
    await vi.advanceTimersByTimeAsync(550);
    await connect;
    expect(freshMoisture(sensor.getSnapshot())).toBe(11.8);
    sensor.disconnect();
    expect(freshMoisture(sensor.getSnapshot())).toBeNull();
    const reconnect = sensor.reconnect();
    await vi.advanceTimersByTimeAsync(1200);
    await reconnect;
    expect(sensor.getSnapshot().state).toBe("connected");
    sensor.dispose();
  });
  it("ignores a cancelled connect and clears readings on timeout", async () => {
    vi.useFakeTimers();
    const sensor = new MockSensorService();
    const scan = sensor.scan();
    await vi.advanceTimersByTimeAsync(650);
    await scan;
    const connect = sensor.connect("demo-esp32");
    sensor.disconnect();
    await connect;
    await vi.advanceTimersByTimeAsync(5000);
    expect(sensor.getSnapshot().state).toBe("disconnected");
    sensor.simulateFailure("timeout");
    expect(sensor.getSnapshot().state).toBe("error");
    expect(freshMoisture(sensor.getSnapshot())).toBeNull();
    sensor.dispose();
  });
  it("rejects stale or future readings", () => {
    const snapshot = {
      state: "connected" as const,
      isMock: true,
      device: null,
      devices: [],
      moisturePercent: 11.8,
      updatedAt: timestamp,
      error: null,
    };
    const now = Date.parse(timestamp);
    expect(freshMoisture(snapshot, now + APP.sensorFreshnessMs + 1)).toBeNull();
    expect(freshMoisture(snapshot, now - 1)).toBeNull();
  });
});

describe("replaceable history repository", () => {
  function setup(initial: string | null = null) {
    let value = initial;
    const storage = {
      getItem: vi.fn(async () => value),
      setItem: vi.fn(async (_key: string, next: string) => {
        value = next;
      }),
    };
    const images = {
      persist: vi.fn(
        async (_uri: string, recordId: string) =>
          `file:///documents/${recordId}.jpg`,
      ),
    };
    return {
      storage,
      images,
      repository: createHistoryRepository(storage, images),
    };
  }
  it("preserves image before saving, deduplicates and reloads after restart", async () => {
    const { repository, storage, images } = setup();
    const [a, b] = await Promise.all([
      repository.save(result()),
      repository.save(result()),
    ]);
    expect(a).toEqual(b);
    expect(images.persist).toHaveBeenCalledTimes(1);
    expect(await repository.list()).toHaveLength(1);
    const restarted = createHistoryRepository(storage, images);
    expect((await restarted.get(id))?.imageUri).toContain("/documents/");
  });
  it("serializes concurrent distinct saves without losing records", async () => {
    const { repository } = setup();
    const next = {
      ...result(),
      id: "455ed849-b0de-4c03-adeb-cce235158ae4",
      timestamp: "2026-10-11T11:00:00.000Z",
    };
    await Promise.all([repository.save(result()), repository.save(next)]);
    const records = await repository.list();
    expect(records.map((r) => r.id)).toEqual([next.id, id]);
  });
  it("preserves corrupt data rather than overwriting history", async () => {
    const { repository, storage } = setup("broken");
    await expect(repository.save(result())).rejects.toThrow("preserved");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("does not save a record when image persistence fails", async () => {
    const { repository, storage, images } = setup();
    images.persist.mockRejectedValueOnce(new Error("Disk full"));
    await expect(repository.save(result())).rejects.toThrow("Disk full");
    expect(storage.setItem).not.toHaveBeenCalled();
    await expect(repository.save(result())).resolves.toHaveProperty("id", id);
  });
});
