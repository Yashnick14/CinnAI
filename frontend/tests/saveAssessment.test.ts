import { describe, expect, it, vi } from "vitest";
import { createHistoryRepository } from "../src/storage/historyRepository";
import { toHistoryRecord } from "../src/services/saveAssessment";
import { createMockResult } from "../src/services/mockGrading";
import type { SampleResult } from "../src/types/decision";
const id = "7d99e15a-8743-4e3d-903c-d3c6952191bb";
const time = "2026-10-25T10:00:00.000Z";
const visual = createMockResult(
  {
    imageUri: "file:///sample.jpg",
    moisturePercent: null,
    scenario: "accepted",
  },
  id,
  time,
);
const sample = {
  status: "VALID",
  final_grade: "M4",
  imageUri: "file:///sample.jpg",
  message: "Validated",
  visual_disagreement: true,
  diagnostics: {
    detector: { detected_quills: 1 },
    diameter: { quill_diameter_mm: 19.4 },
    visual: {
      visual_prediction: "H1",
      visual_confidence: 0.81,
      probabilities: visual.visualProbabilities,
    },
  },
  moisture: {
    raw_value: 2910,
    percentage: null,
    status: "PASS_PROVISIONAL",
    timestamp: time,
    read_status: "fresh",
  },
} as SampleResult;
function setup() {
  let data: string | null = null;
  const store = {
    getItem: vi.fn(async () => data),
    setItem: vi.fn(async (_key: string, value: string) => {
      data = value;
    }),
  };
  const images = { persist: vi.fn(async () => "file:///preserved.jpg") };
  return { repo: createHistoryRepository(store, images), store, images };
}
describe("assessment history", () => {
  it("saves diameter grade with supporting RF and raw ADC without percentage", async () => {
    const { repo, images } = setup();
    const record = toHistoryRecord(sample, id, time);
    await repo.save(record);
    const saved = await repo.get(id);
    expect(saved).toMatchObject({
      finalGrade: "M4",
      visualPrediction: "H1",
      diameterMm: 19.4,
      moistureRawAdc: 2910,
      moistureCapturedAt: time,
      moisturePercent: null,
      moistureStatus: "PASS",
      imageUri: "file:///preserved.jpg",
    });
    await repo.save(record);
    expect(await repo.list()).toHaveLength(1);
    expect(images.persist).toHaveBeenCalledTimes(1);
  });
  it("never saves an RF grade as the final grade for invalid samples", () => {
    const record = toHistoryRecord(
      { ...sample, status: "INVALID", final_grade: null },
      id,
      time,
    );
    expect(record.finalGrade).toBeNull();
    expect(record.visualPrediction).toBeNull();
  });
  it("retains diameter grade when moisture fails or is absent", () => {
    expect(
      toHistoryRecord(
        {
          ...sample,
          moisture: { ...sample.moisture!, status: "FAIL_PROVISIONAL" },
        },
        id,
        time,
      ),
    ).toMatchObject({ finalGrade: "M4", moistureStatus: "FAIL" });
    expect(
      toHistoryRecord({ ...sample, moisture: undefined }, id, time),
    ).toMatchObject({
      finalGrade: "M4",
      moistureStatus: "UNAVAILABLE",
      moisturePercent: null,
    });
  });
  it("deletes only the requested record and persists across reads", async () => {
    const { repo } = setup();
    await repo.save(toHistoryRecord(sample, id, time));
    const other = "8d99e15a-8743-4e3d-903c-d3c6952191bb";
    await repo.save(toHistoryRecord(sample, other, time));
    await repo.remove(id);
    expect(await repo.get(id)).toBeUndefined();
    expect((await repo.list()).map((r) => r.id)).toEqual([other]);
  });
  it("serializes concurrent save/delete and recovers after a failed write", async () => {
    const { repo, store } = setup();
    const record = toHistoryRecord(sample, id, time);
    await Promise.all([repo.save(record), repo.remove(id)]);
    expect(await repo.list()).toEqual([]);
    await repo.save(record);
    store.setItem.mockRejectedValueOnce(new Error("full"));
    await expect(repo.remove(id)).rejects.toThrow("full");
    expect(await repo.get(id)).toBeDefined();
    await repo.remove(id);
    expect(await repo.list()).toEqual([]);
  });
  it("does not erase unreadable history", async () => {
    const { repo, store } = setup();
    store.getItem.mockResolvedValue("corrupt");
    await expect(repo.remove(id)).rejects.toThrow("preserved");
    expect(store.setItem).not.toHaveBeenCalled();
  });
});

import { reviewedRecord } from "../src/services/manualReview";
const review = {
  selectedGrade: "C4",
  reviewer: "Reviewer One",
  reason: "Visual inspection disagrees",
  notes: "Checked sample.",
};
it("stores a human override without altering the automatic result", () => {
  const record = reviewedRecord(sample, review, id, time);
  expect(record.finalGrade).toBe("C4");
  expect(record.manualReview).toMatchObject({
    originalStatus: "VALID",
    originalGrade: "M4",
    reviewer: "Reviewer One",
  });
  expect(sample.final_grade).toBe("M4");
  expect(record.diameterMm).toBe(19.4);
});
it("allows boundary grade selection and retains uncertain status evidence", () => {
  const boundary = {
    ...sample,
    status: "UNCERTAIN",
    final_grade: null,
    diagnostics: {
      ...sample.diagnostics,
      diameter: {
        ...sample.diagnostics.diameter!,
        quill_diameter_mm: 21,
        diameter_grade: "Manual review",
      },
    },
  } as SampleResult;
  const record = reviewedRecord(boundary, review, id, time);
  expect(record.finalGrade).toBe("C4");
  expect(record.manualReview).toMatchObject({
    originalStatus: "UNCERTAIN",
    originalGrade: null,
    originalDiameterGrade: "Manual review",
  });
});
it("does not mark failed automatic checks as valid after human review", () => {
  const record = reviewedRecord(
    { ...sample, status: "INVALID", final_grade: null },
    review,
    id,
    time,
  );
  expect(record.manualReview?.originalStatus).toBe("INVALID");
  expect(record.warnings.join(" ")).toContain("INVALID");
});
it("requires reviewer, reason and a supported grade", () => {
  for (const patch of [
    { reviewer: " " },
    { reason: "" },
    { selectedGrade: "H3" },
  ]) {
    expect(() =>
      reviewedRecord(sample, { ...review, ...patch }, id, time),
    ).toThrow();
  }
});
it("manual grading preserves moisture failure", () => {
  const record = reviewedRecord(
    {
      ...sample,
      moisture: { ...sample.moisture!, status: "FAIL_PROVISIONAL" },
    },
    review,
    id,
    time,
  );
  expect(record.finalGrade).toBe("C4");
  expect(record.finalStatus).toBe("MOISTURE_NON_COMPLIANT");
});
it("review metadata survives history storage", async () => {
  const { repo } = setup();
  const record = reviewedRecord(sample, review, id, time);
  await repo.save(record);
  expect((await repo.get(id))?.manualReview).toEqual(record.manualReview);
});
