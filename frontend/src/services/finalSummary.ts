import { displayedGrade, type SampleResult } from "../types/decision";
import { moistureQuality } from "./moistureCapture";

/** Keep the diameter-based grade separate from the moisture-only export-quality status. */
export function finalSummary(result: SampleResult) {
  const grade = displayedGrade(result);
  return {
    grade,
    exportQuality: grade ? moistureQuality(result.moisture) : "UNAVAILABLE",
  };
}
