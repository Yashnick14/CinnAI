import type { GradeRequest, GradingResult } from "../types/grading";
import { GRADING_RULES } from "../config/grading";

// Explicit UI fixtures only. No image processing, inference, or diameter algorithm.
export function createMockResult(
  request: GradeRequest,
  id: string,
  timestamp: string,
): GradingResult {
  const result: GradingResult = {
    id,
    timestamp,
    imageUri: request.imageUri,
    isMock: true,
    source: "local_mock",
    detectedQuillCount: 1,
    visualPrediction: "M4",
    visualConfidence: 0.71,
    visualProbabilities: {
      Alba: 0.01,
      C4: 0.02,
      C5: 0.01,
      "C5 Special": 0.01,
      H1: 0.08,
      H2: 0.03,
      M4: 0.71,
      M5: 0.13,
    },
    diameterMm: 23,
    diameterCandidates: ["H1", "M4", "M5"],
    candidateProbabilities: { H1: 0.08, M4: 0.71, M5: 0.13 },
    finalCandidateConfidence: 0.71 / 0.92,
    finalGrade: "M4",
    moisturePercent: request.moisturePercent,
    moistureStatus:
      request.moisturePercent === null
        ? "UNAVAILABLE"
        : request.moisturePercent < GRADING_RULES.moistureLimitPercent
          ? "PASS"
          : "FAIL",
    finalStatus: "GRADE_ACCEPTED",
    warnings: [
      "DEMO ONLY: the image was not analysed. Grade, diameter and probabilities are illustrative fixtures.",
    ],
  };
  if (request.scenario === "moisture_fail") {
    result.moisturePercent = 15.1;
    result.moistureStatus = "FAIL";
    result.warnings.push(
      "Demo scenario supplies an illustrative moisture reading of 15.1%.",
    );
  }
  if (result.moistureStatus === "FAIL")
    result.finalStatus = "MOISTURE_NON_COMPLIANT";
  if (result.moistureStatus === "UNAVAILABLE") {
    result.finalStatus = "MANUAL_REVIEW";
    result.warnings.push(
      "No fresh moisture reading was available. Compliance cannot be established.",
    );
  }
  if (request.scenario === "manual_review") {
    result.visualPrediction = "Alba";
    result.visualConfidence = 1;
    result.visualProbabilities = {
      Alba: 1,
      C4: 0,
      C5: 0,
      "C5 Special": 0,
      H1: 0,
      H2: 0,
      M4: 0,
      M5: 0,
    };
    result.candidateProbabilities = { H1: 0, M4: 0, M5: 0 };
    result.finalGrade = null;
    result.finalCandidateConfidence = null;
    result.finalStatus = "MANUAL_REVIEW";
    result.warnings.push(
      "Illustrative visual and diameter conflict: compatible grades have no visual support.",
    );
  }
  if (
    request.scenario === "measurement_error" ||
    request.scenario === "no_quill"
  ) {
    result.diameterMm = null;
    result.diameterCandidates = [];
    result.candidateProbabilities = {};
    result.finalGrade = null;
    result.finalCandidateConfidence = null;
    result.finalStatus = "MEASUREMENT_ERROR";
    result.warnings.push(
      "Illustrative measurement failure: reference coin or reliable quill measurement unavailable.",
    );
  }
  if (request.scenario === "no_quill") {
    result.detectedQuillCount = 0;
    result.visualPrediction = null;
    result.visualConfidence = null;
    result.visualProbabilities = {
      Alba: 0,
      C4: 0,
      C5: 0,
      "C5 Special": 0,
      H1: 0,
      H2: 0,
      M4: 0,
      M5: 0,
    };
    result.warnings.push("Illustrative detection failure: no quill detected.");
  }
  return result;
}
