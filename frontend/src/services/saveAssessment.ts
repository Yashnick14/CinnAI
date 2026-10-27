import { GradingResultSchema } from "../types/grading";
import { displayedGrade, type SampleResult } from "../types/decision";
import { SUPPORTED_GRADES } from "../config/grading";
import { moistureQuality } from "./moistureCapture";

export function toHistoryRecord(
  result: SampleResult,
  id: string,
  timestamp: string,
) {
  const grade = displayedGrade(result);
  const visual = grade ? result.diagnostics.visual : null;
  const moisture = moistureQuality(result.moisture);
  return GradingResultSchema.parse({
    id,
    timestamp,
    imageUri: result.imageUri,
    isMock: false,
    source: "api",
    detectedQuillCount: result.diagnostics.detector?.detected_quills ?? 0,
    visualPrediction: visual?.visual_prediction ?? null,
    visualConfidence: visual?.visual_confidence ?? null,
    visualProbabilities:
      visual?.probabilities ??
      Object.fromEntries(SUPPORTED_GRADES.map((g) => [g, 0])),
    diameterMm: result.diagnostics.diameter?.quill_diameter_mm ?? null,
    diameterCandidates: grade ? [grade] : [],
    candidateProbabilities: {},
    finalCandidateConfidence: null,
    moisturePercent: null,
    moistureStatus: moisture,
    moistureRawAdc: result.moisture?.raw_value ?? null,
    moistureCapturedAt: result.moisture?.timestamp ?? null,
    finalGrade: grade,
    finalStatus: grade
      ? moisture === "FAIL"
        ? "MOISTURE_NON_COMPLIANT"
        : "GRADE_ACCEPTED"
      : result.status === "INVALID"
        ? "MEASUREMENT_ERROR"
        : "MANUAL_REVIEW",
    warnings: [
      result.message,
      ...(result.visual_disagreement
        ? [
            "Visual evidence differs from the diameter grade. The diameter grade is retained.",
          ]
        : []),
    ],
  });
}
