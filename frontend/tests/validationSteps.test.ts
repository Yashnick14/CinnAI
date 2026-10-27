import { expect, it } from "vitest";
import { validationSteps } from "../src/utils/validationSteps";
import type { SampleResult } from "../src/types/decision";
function result(overrides = {}) {
  return {
    status: "VALID",
    diagnostics: {
      detector: { detected_quills: 1 },
      diameter: {},
      visual: {},
      errors: {},
    },
    ...overrides,
  } as SampleResult;
}
it("never invents passed checks while awaiting a response", () => {
  expect(validationSteps(null).every((s) => s.state === "pending")).toBe(true);
  expect(
    validationSteps(null, true).every((s) => s.state === "unavailable"),
  ).toBe(true);
});
it("ticks all completed valid checks without exposing a grade", () => {
  const steps = validationSteps(result());
  expect(steps.every((s) => s.state === "passed")).toBe(true);
  expect(JSON.stringify(steps)).not.toContain("visual_prediction");
});
it("crosses missing quill evidence even if RF completed", () => {
  const steps = validationSteps(
    result({
      status: "INVALID",
      diagnostics: {
        detector: { detected_quills: 0 },
        visual: { visual_prediction: "H2" },
        diameter: null,
        errors: {
          quill_missing: true,
          diameter_diagnostics: {
            segmentation: {
              missing_classes: ["quill"],
              confidences: { coin: 0.9 },
            },
          },
        },
      },
    }),
  );
  expect(steps.map((s) => s.state)).toEqual([
    "failed",
    "failed",
    "passed",
    "failed",
    "passed",
    "failed",
  ]);
  expect(JSON.stringify(steps)).not.toContain("H2");
});
it("keeps partial evidence when the coin is missing", () => {
  const steps = validationSteps(
    result({
      status: "UNCERTAIN",
      diagnostics: {
        detector: { detected_quills: 1 },
        visual: {},
        diameter: null,
        errors: {
          diameter_diagnostics: {
            segmentation: {
              missing_classes: ["coin"],
              confidences: { quill: 0.9 },
            },
          },
        },
      },
    }),
  );
  expect(steps.map((s) => s.state)).toEqual([
    "passed",
    "passed",
    "failed",
    "failed",
    "passed",
    "failed",
  ]);
});
it("marks manual review as unapproved while measurement remains passed", () => {
  const steps = validationSteps(result({ status: "UNCERTAIN" }));
  expect(steps[3]?.state).toBe("passed");
  expect(steps[5]?.state).toBe("failed");
});
