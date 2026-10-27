export const SUPPORTED_GRADES = [
  "Alba",
  "C4",
  "C5",
  "C5 Special",
  "H1",
  "H2",
  "M4",
  "M5",
] as const;
export const REFERENCE_COIN_DIAMETER_MM = 26.4;
// Reserved for the later real decision pipeline; demo fixtures do not execute these rules.
export const GRADING_RULES = {
  diameterMm: {
    Alba: { min: 0, max: 7, maxInclusive: false },
    "C5 Special": { min: 8, max: 10, maxInclusive: true },
    C5: { min: 10, max: 12, maxInclusive: true },
    C4: { min: 12, max: 16, maxInclusive: true },
    M5: { min: 18, max: 23, maxInclusive: true },
    M4: { min: 21, max: 23, maxInclusive: true },
    H1: { min: 23, max: 32, maxInclusive: true },
    H2: { min: 32, max: 38, maxInclusive: true },
  },
  minAbsoluteCandidateProbability: 0.1,
  minNormalizedCandidateConfidence: 0.5,
  moistureLimitPercent: 14.0,
} as const;
