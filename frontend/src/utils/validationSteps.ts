import { z } from "zod";
import type { SampleResult } from "../types/decision";

export type CheckState = "pending" | "passed" | "failed" | "unavailable";
export interface ValidationStep {
  label: string;
  state: CheckState;
  detail: string;
}
const labels = [
  "Quill detection",
  "Quill segmentation",
  "Coin reference",
  "Diameter measurement",
  "Visual analysis",
  "Sample validation",
] as const;
const evidenceSchema = z.object({
  stage: z.string().optional(),
  segmentation: z
    .object({
      missing_classes: z.array(z.string()).optional(),
      confidences: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
});

export function validationSteps(
  result: SampleResult | null,
  interrupted = false,
): ValidationStep[] {
  if (!result)
    return labels.map((label) => ({
      label,
      state: interrupted ? "unavailable" : "pending",
      detail: interrupted
        ? "Not confirmed. Retry the analysis."
        : "Awaiting validation response",
    }));
  const { detector, diameter, visual, errors } = result.diagnostics;
  const evidence = evidenceSchema.safeParse(errors.diameter_diagnostics);
  const report = evidence.success ? evidence.data : undefined;
  const missing = report?.segmentation?.missing_classes ?? [];
  const confidence = report?.segmentation?.confidences ?? {};
  const quillMissing =
    errors.quill_missing === true || missing.includes("quill");
  const coinPassed =
    !!diameter ||
    (!missing.includes("coin") && confidence.coin !== undefined) ||
    report?.stage === "segmentation_quill_measurement";
  const quillPassed =
    !!diameter || (!quillMissing && confidence.quill !== undefined);
  return [
    {
      label: labels[0],
      state: detector
        ? detector.detected_quills > 0
          ? "passed"
          : "failed"
        : "unavailable",
      detail: detector
        ? detector.detected_quills > 0
          ? "Quill detection confirmed"
          : "No quill detected. Recapture a clear sample."
        : "Detector check could not complete.",
    },
    {
      label: labels[1],
      state: quillMissing ? "failed" : quillPassed ? "passed" : "unavailable",
      detail: quillMissing
        ? "A usable quill mask was not found."
        : quillPassed
          ? "Quill segmentation confirmed"
          : "Quill mask could not be confirmed.",
    },
    {
      label: labels[2],
      state: missing.includes("coin")
        ? "failed"
        : coinPassed
          ? "passed"
          : "unavailable",
      detail: missing.includes("coin")
        ? "Place the Rs.10 coin clearly beside the quill."
        : coinPassed
          ? "Coin reference detected"
          : "Coin reference could not be confirmed.",
    },
    {
      label: labels[3],
      state: diameter
        ? "passed"
        : missing.length ||
            (report?.stage?.startsWith("segmentation_") &&
              report.stage !== "segmentation_prediction")
          ? "failed"
          : "unavailable",
      detail: diameter
        ? "Width measurement completed"
        : "A usable coin and quill measurement is required.",
    },
    {
      label: labels[4],
      state: visual
        ? "passed"
        : errors.visual && detector?.detected_quills === 0
          ? "failed"
          : "unavailable",
      detail: visual
        ? "Supporting visual analysis completed"
        : "Visual analysis could not be completed.",
    },
    {
      label: labels[5],
      state: result.status === "VALID" ? "passed" : "failed",
      detail:
        result.status === "VALID"
          ? "Required checks passed. Your result is ready."
          : result.status === "INVALID"
            ? "Sample not verified. Please recapture."
            : "More evidence or manual review is required.",
    },
  ];
}
