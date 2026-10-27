import { z } from "zod";
import { uploadPhoto } from "./uploadPhoto";
import { API } from "../config/api";
import {
  GradingResultSchema,
  type GradeRequest,
  type GradingResult,
} from "../types/grading";

// Validate the REST contract at the boundary before mapping snake_case to mobile types.
export const ApiResultSchema = z.object({
  id: GradingResultSchema.shape.id,
  timestamp: GradingResultSchema.shape.timestamp,
  is_mock: z.boolean(),
  detected_quill_count: GradingResultSchema.shape.detectedQuillCount,
  visual_prediction: GradingResultSchema.shape.visualPrediction,
  visual_confidence: GradingResultSchema.shape.visualConfidence,
  visual_probabilities: GradingResultSchema.shape.visualProbabilities,
  diameter_mm: GradingResultSchema.shape.diameterMm,
  diameter_candidates: GradingResultSchema.shape.diameterCandidates,
  candidate_probabilities: GradingResultSchema.shape.candidateProbabilities,
  final_candidate_confidence:
    GradingResultSchema.shape.finalCandidateConfidence,
  moisture_percent: GradingResultSchema.shape.moisturePercent,
  moisture_status: GradingResultSchema.shape.moistureStatus,
  final_grade: GradingResultSchema.shape.finalGrade,
  final_status: GradingResultSchema.shape.finalStatus,
  warnings: z.array(z.string()),
});
export function mapApiResult(raw: unknown, imageUri: string): GradingResult {
  const r = ApiResultSchema.parse(raw);
  return GradingResultSchema.parse({
    id: r.id,
    timestamp: r.timestamp,
    imageUri,
    isMock: r.is_mock,
    source: r.is_mock ? "api_mock" : "api",
    detectedQuillCount: r.detected_quill_count,
    visualPrediction: r.visual_prediction,
    visualConfidence: r.visual_confidence,
    visualProbabilities: r.visual_probabilities,
    diameterMm: r.diameter_mm,
    diameterCandidates: r.diameter_candidates,
    candidateProbabilities: r.candidate_probabilities,
    finalCandidateConfidence: r.final_candidate_confidence,
    moisturePercent: r.moisture_percent,
    moistureStatus: r.moisture_status,
    finalGrade: r.final_grade,
    finalStatus: r.final_status,
    warnings: r.warnings,
  });
}
export async function gradeViaApi(
  request: GradeRequest,
  signal: AbortSignal,
): Promise<GradingResult> {
  if (!/^https?:\/\//.test(API.baseUrl))
    throw new Error(
      "Set EXPO_PUBLIC_API_URL to your reachable backend URL, then restart Metro.",
    );
  const body = new FormData();
  body.append("image", await uploadPhoto(request.imageUri), "cinnamon.jpg");
  if (request.moisturePercent !== null)
    body.append("moisture_percent", String(request.moisturePercent));
  body.append("mock_scenario", request.scenario);
  let response: Response;
  try {
    response = await fetch(`${API.baseUrl}/api/v1/grade`, {
      method: "POST",
      body,
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    const cause = error instanceof Error ? error.message.trim() : "";
    throw new Error(
      `Cannot reach the backend. Check your network, API URL and backend server.${
        cause ? ` Device error: ${cause}` : ""
      }`,
    );
  }
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      detail?: unknown;
    } | null;
    throw new Error(
      typeof detail?.detail === "string"
        ? detail.detail
        : `Backend request failed (${response.status}). Please retry.`,
    );
  }
  try {
    return mapApiResult(await response.json(), request.imageUri);
  } catch {
    throw new Error(
      "The backend returned an incompatible grading response. Check the API version.",
    );
  }
}
