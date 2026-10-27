import type { GradingResult } from "../types/grading";
import { summarize } from "./historySummary";
export function accountSummary(records: GradingResult[]) {
  const graded = records.filter((record) => record.finalGrade !== null);
  const counts = new Map<string, number>();
  graded.forEach((record) =>
    counts.set(record.finalGrade!, (counts.get(record.finalGrade!) ?? 0) + 1),
  );
  return {
    assessments: records.length,
    gradedQuills: graded.reduce(
      (sum, record) => sum + record.detectedQuillCount,
      0,
    ),
    manualReviews: records.filter((record) => !!record.manualReview).length,
    common: summarize(graded).common,
    grades: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}
