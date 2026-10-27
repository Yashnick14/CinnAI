import { z } from "zod";
import { GradeSchema } from "./grading";
import { DiameterSchema } from "./diameter";
import { VisualResponseSchema } from "./visual";
export const DecisionSchema = z
  .object({
    status: z.enum(["VALID", "UNCERTAIN", "INVALID"]),
    final_grade: GradeSchema.nullable(),
    message: z.string(),
    visual_disagreement: z.boolean(),
    debug_comparison: z
      .object({
        legacy_detector: z
          .object({
            quill_detected: z.boolean(),
            max_confidence: z.number().min(0).max(1).nullable(),
          })
          .nullable(),
        segmentation_model: z
          .object({
            coin_detected: z.boolean(),
            coin_confidence: z.number().min(0).max(1).nullable(),
            quill_detected: z.boolean(),
            quill_confidence: z.number().min(0).max(1).nullable(),
            coin_detection_count: z.number().int().nonnegative(),
            quill_detection_count: z.number().int().nonnegative(),
            segmentation_available: z.boolean(),
          })
          .nullable(),
      })
      .optional(),
    diagnostics: z.object({
      detector: z
        .object({
          detected_quills: z.number().int().nonnegative(),
          confidences: z.array(z.number().min(0).max(1)),
        })
        .nullable(),
      visual: VisualResponseSchema.nullable(),
      diameter: DiameterSchema.extend({
        valid_rows: z.number().int().positive(),
        coin_confidence: z.number().min(0).max(1),
        quill_confidence: z.number().min(0).max(1),
      }).nullable(),
      errors: z.record(z.string(), z.unknown()),
      moisture: z.object({ status: z.string(), required: z.boolean() }),
    }),
  })
  .superRefine((r, ctx) => {
    if (
      r.status === "VALID"
        ? !r.final_grade ||
          !r.diagnostics.visual ||
          !r.diagnostics.diameter ||
          !r.diagnostics.detector?.detected_quills ||
          Object.keys(r.diagnostics.errors).length > 0 ||
          r.final_grade !== r.diagnostics.diameter.diameter_grade
        : r.final_grade !== null
    )
      ctx.addIssue({
        code: "custom",
        message: "Inconsistent sample validation decision",
      });
  });
export type SampleResult = z.infer<typeof DecisionSchema> & {
  imageUri: string;
  sessionId?: string;
  moisture?: import("../services/sessionMoisture").SessionMoisture;
};
export function displayedGrade(result: SampleResult) {
  return result.status === "VALID" ? result.final_grade : null;
}
