import { describe, it, expect } from "vitest";
import {
  displayedGrade,
  DecisionSchema,
  type SampleResult,
} from "../src/types/decision";
describe("sample grade visibility", () => {
  it.each([
    "PASS_PROVISIONAL",
    "FAIL_PROVISIONAL",
    "UNAVAILABLE",
    "DEMO",
  ] as const)("moisture %s cannot override diameter", (status) => {
    const result = {
      status: "VALID",
      final_grade: "M4",
      moisture: { status },
    } as SampleResult;
    expect(displayedGrade(result)).toBe("M4");
    expect(displayedGrade({ ...result, status: "INVALID" })).toBeNull();
  });
  it.each(["INVALID", "UNCERTAIN"] as const)(
    "hides all grades for %s even with RF diagnostics",
    (status) => {
      const result = {
        status,
        final_grade: "H2",
        diagnostics: { visual: { visual_prediction: "C4" } },
      } as SampleResult;
      expect(displayedGrade(result)).toBeNull();
    },
  );
  it("displays diameter decision rather than RF grade", () => {
    const result = {
      status: "VALID",
      final_grade: "H1",
      diagnostics: { visual: { visual_prediction: "C4" } },
    } as SampleResult;
    expect(displayedGrade(result)).toBe("H1");
  });
  it("rejects incomplete valid response", () => {
    expect(
      DecisionSchema.safeParse({ status: "VALID", final_grade: "H2" }).success,
    ).toBe(false);
  });
});
