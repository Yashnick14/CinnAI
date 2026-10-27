import { z } from "zod";
import { GradeSchema } from "./grading";
import type { CaptureGeometry } from "../config/captureGuides";
import type { DiameterResult } from "./diameter";

const probability = z.number().min(0).max(1);
export const VisualResponseSchema = z
  .object({
    detected_quills: z.number().int().nonnegative(),
    visual_prediction: GradeSchema,
    visual_confidence: probability,
    probabilities: z.record(GradeSchema, probability),
  })
  .superRefine((result, context) => {
    const values = Object.values(result.probabilities);
    if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 0.0001)
      context.addIssue({
        code: "custom",
        message: "Probabilities must sum to one.",
      });
    if (
      Math.abs(
        result.probabilities[result.visual_prediction] -
          result.visual_confidence,
      ) > 0.0001 ||
      result.visual_confidence + 0.0001 < Math.max(...values)
    )
      context.addIssue({
        code: "custom",
        message:
          "Prediction and confidence must match the probability distribution.",
      });
  });

export interface VisualRequest {
  sessionId?: string;
  moisture?: import("../services/sessionMoisture").SessionMoisture;
  imageUri: string;
  captureGeometry?: CaptureGeometry;
}
export interface VisualResult {
  diameter?: DiameterResult;
  diameterError?: string;
  imageUri: string;
  detectedQuills: number;
  visualPrediction: z.infer<typeof GradeSchema>;
  visualConfidence: number;
  probabilities: z.infer<typeof VisualResponseSchema>["probabilities"];
}
