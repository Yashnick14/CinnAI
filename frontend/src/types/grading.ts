import { z } from "zod";
import { SUPPORTED_GRADES } from "../config/grading";

export const GradeSchema = z.enum(SUPPORTED_GRADES);
export type Grade = z.infer<typeof GradeSchema>;
const Probability = z.number().min(0).max(1);
const ProbabilityMap = z.record(GradeSchema, Probability);
const CandidateMap = z.partialRecord(GradeSchema, Probability);
export const GradingResultSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  imageUri: z.string().optional(),
  isMock: z.boolean(),
  source: z.enum(["local_mock", "api_mock", "api"]),
  detectedQuillCount: z.number().int().nonnegative(),
  visualPrediction: GradeSchema.nullable(),
  visualConfidence: Probability.nullable(),
  visualProbabilities: ProbabilityMap,
  diameterMm: z.number().nonnegative().nullable(),
  diameterCandidates: z.array(GradeSchema),
  candidateProbabilities: CandidateMap,
  finalCandidateConfidence: Probability.nullable(),
  moisturePercent: z.number().min(0).max(100).nullable(),
  moistureRawAdc: z.number().int().nonnegative().nullable().optional(),
  moistureCapturedAt: z.string().datetime().nullable().optional(),
  moistureStatus: z.enum(["PASS", "FAIL", "UNAVAILABLE"]),
  finalGrade: GradeSchema.nullable(),
  finalStatus: z.enum([
    "GRADE_ACCEPTED",
    "MANUAL_REVIEW",
    "MOISTURE_NON_COMPLIANT",
    "MEASUREMENT_ERROR",
  ]),
  manualReview: z
    .object({
      selectedGrade: GradeSchema,
      reviewer: z.string().trim().min(1),
      reason: z.string().trim().min(1),
      notes: z.string(),
      reviewedAt: z.string().datetime(),
      originalStatus: z.enum(["VALID", "UNCERTAIN", "INVALID"]),
      originalGrade: GradeSchema.nullable(),
      originalDiameterGrade: z.string().nullable(),
      originalMessage: z.string(),
    })
    .optional(),
  warnings: z.array(z.string()),
});
export type GradingResult = z.infer<typeof GradingResultSchema>;
export type DemoScenario =
  | "accepted"
  | "moisture_fail"
  | "manual_review"
  | "measurement_error"
  | "no_quill";
export interface GradeRequest {
  imageUri: string;
  moisturePercent: number | null;
  scenario: DemoScenario;
}
