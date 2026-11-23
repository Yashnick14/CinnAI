import { describe, expect, it } from "vitest";
import { createMockResult } from "../src/services/mockGrading";
import {
  reportRange,
  formatReportDateInput,
  summarizeQuality,
  qualityReportHtml,
} from "../src/services/qualityReport";
const now = new Date(2026, 10, 20, 12);
const base = {
  ...createMockResult(
    { imageUri: "x", moisturePercent: null, scenario: "accepted" },
    "sample",
    now.toISOString(),
  ),
  isMock: false,
  source: "api" as const,
  finalGrade: "M4" as const,
  detectedQuillCount: 2,
  moistureStatus: "PASS" as const,
  moistureRawAdc: 1750,
  moisturePercent: null,
};
describe("quality reports", () => {
  it("uses inclusive local calendar days", () => {
    expect(reportRange("day", now).start).toEqual(new Date(2026, 10, 20));
    expect(reportRange("week", now).start).toEqual(new Date(2026, 10, 14));
    expect(reportRange("month", now).start).toEqual(new Date(2026, 9, 22));
    expect(reportRange("day", now).end).toEqual(new Date(2026, 10, 21));
  });
  it("rejects invalid and reversed custom dates", () => {
    for (const [a, b] of [
      ["2026-02-31", "2026-03-01"],
      ["2026-11-20", "2026-11-19"],
    ])
      expect(() => reportRange("custom", now, a, b)).toThrow();
    expect(reportRange("custom", now, "2024-02-29", "2024-02-29").start.getDate()).toBe(
      29,
    );
  });
  it("excludes mock, future and out-of-range records and deduplicates IDs", () => {
    const records = [
      base,
      base,
      { ...base, id: "mock", isMock: true },
      { ...base, id: "old", timestamp: new Date(2026, 10, 19).toISOString() },
      { ...base, id: "future", timestamp: new Date(2026, 10, 20, 13).toISOString() },
    ];
    expect(summarizeQuality(records, reportRange("day", now), now).assessments).toBe(1);
  });
  it("averages readings rather than quill counts and excludes missing/untouched readings", () => {
    const result = summarizeQuality(
      [
        base,
        { ...base, id: "b", moistureRawAdc: 1850, detectedQuillCount: 1 },
        { ...base, id: "c", moistureRawAdc: 2960 },
        { ...base, id: "d", moistureRawAdc: null },
      ],
      reportRange("day", now),
      now,
    );
    const row = result.rows.find((r) => r.grade === "M4")!;
    expect(row.assessments).toBe(4);
    expect(row.quills).toBe(7);
    expect(row.averageAdc).toBe(1800);
    expect(row.readingCount).toBe(2);
    expect(row.averagePercent).toBeNull();
    expect(row.unavailable).toBe(2);
  });
  it("uses saved final grades and only actual supplied percentages", () => {
    const result = summarizeQuality(
      [
        base,
        { ...base, id: "b", finalGrade: "Alba", moisturePercent: 12 },
        { ...base, id: "c", finalGrade: null },
      ],
      reportRange("day", now),
      now,
    );
    expect(result.rows.find((r) => r.grade === "Alba")!.averagePercent).toBe(12);
    expect(result.unassigned).toBe(1);
    expect(result.quills).toBe(4);
  });
  it("renders zero counts and escapes account text", () => {
    const html = qualityReportHtml([], reportRange("day", now), "<script> & name", now);
    expect(html).toContain("No saved assessments");
    expect(html).toContain("&lt;script&gt; &amp; name");
    expect(html).not.toContain("<script>");
  });
});

it("formats typed dates and allows deleting separators", () => {
  expect(formatReportDateInput("2026")).toBe("2026-");
  expect(formatReportDateInput("2026-11")).toBe("2026-11-");
  expect(formatReportDateInput("20261120")).toBe("2026-11-20");
  expect(formatReportDateInput("2026", "2026-")).toBe("2026");
});
it("includes saved records when a custom range ends in the future", () => {
  expect(
    summarizeQuality(
      [base],
      reportRange("custom", now, "2026-11-01", "2026-11-30"),
      now,
    ).assessments,
  ).toBe(1);
});

it("reports category counts rather than presenting ADC as moisture percentage", () => {
  const html = qualityReportHtml([base], reportRange("day", now), "Admin", now);
  expect(html).not.toContain("Avg. ADC");
  expect(html).not.toContain("Avg. moisture %");
  expect(html).toContain("application screening categories");
});
