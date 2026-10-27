import { z } from "zod";
import { GradeSchema, GradingResultSchema } from "../types/grading";
import type { SampleResult } from "../types/decision";
import { toHistoryRecord } from "./saveAssessment";

export const ReviewInputSchema = z.object({
  selectedGrade: GradeSchema,
  reviewer: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000),
});
export function reviewedRecord(
  result: SampleResult,
  input: unknown,
  id: string,
  timestamp: string,
) {
  const review = ReviewInputSchema.parse(input);
  const original = toHistoryRecord(result, id, timestamp);
  return GradingResultSchema.parse({
    ...original,
    finalGrade: review.selectedGrade,
    finalStatus:
      original.moistureStatus === "FAIL"
        ? "MOISTURE_NON_COMPLIANT"
        : "GRADE_ACCEPTED",
    manualReview: {
      ...review,
      reviewedAt: timestamp,
      originalStatus: result.status,
      originalGrade: result.final_grade,
      originalDiameterGrade:
        result.diagnostics.diameter?.diameter_grade ?? null,
      originalMessage: result.message,
    },
    warnings: [
      ...original.warnings,
      "Grade assigned by human review: " +
        review.reviewer +
        ". Reason: " +
        review.reason +
        ". Automatic validation status remains " +
        result.status +
        ".",
    ],
  });
}
