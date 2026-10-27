import { displayedGrade, type SampleResult } from "../types/decision";
import { moistureQuality } from "./moistureCapture";
export function finalSummary(result: SampleResult) {
  const grade = displayedGrade(result);
  return {
    grade,
    exportQuality: grade ? moistureQuality(result.moisture) : "UNAVAILABLE",
  };
}
