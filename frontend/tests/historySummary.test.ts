import { describe, expect, it } from "vitest";
import { createMockResult } from "../src/services/mockGrading";
import {
  filterHistory,
  isToday,
  recordLabel,
  summarize,
} from "../src/utils/historySummary";

const a = createMockResult(
  { imageUri: "file:///a.jpg", moisturePercent: 11.8, scenario: "accepted" },
  "7d99e15a-8743-4e3d-903c-d3c6952191bb",
  new Date().toISOString(),
);
const b = {
  ...a,
  id: "455ed849-b0de-4c03-adeb-cce235158ae4",
  finalGrade: "Alba" as const,
  visualConfidence: 0.9,
};

describe("dashboard and searchable register", () => {
  it("shows empty summaries without invented statistics", () => {
    expect(summarize([])).toEqual({
      count: 0,
      averageConfidence: null,
      common: null,
    });
  });
  it("uses actual confidence values and handles tied grades", () => {
    expect(summarize([a, b]).averageConfidence).toBeCloseTo(0.805);
    expect(summarize([a, b]).common).toBe("Multiple grades");
    expect(summarize([a, b, { ...a, id: "another" }]).common).toBe("M4");
  });
  it("combines text search and grade filters", () => {
    expect(filterHistory([a, b], recordLabel(a.id), "All Grades")).toEqual([a]);
    expect(filterHistory([a, b], "alba", "Alba")).toEqual([b]);
    expect(filterHistory([a, b], "alba", "M4")).toEqual([]);
  });
  it("uses the local calendar day for Today", () => {
    const now = new Date(2026, 9, 11, 12);
    expect(isToday(new Date(2026, 9, 11, 0).toISOString(), now)).toBe(true);
    expect(isToday(new Date(2026, 9, 10, 23, 59).toISOString(), now)).toBe(
      false,
    );
    expect(
      filterHistory(
        [a, { ...b, timestamp: "2000-01-01T00:00:00.000Z" }],
        "",
        "Today",
      ),
    ).toEqual([a]);
  });
});
