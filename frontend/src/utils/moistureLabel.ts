import { ADC_UNTOUCHED_THRESHOLD } from "../config/ble";

/** Describe screening categories without claiming a measured moisture percentage. */
export function moistureLabel(status: string, adc?: number | null) {
  if (adc == null || !Number.isFinite(adc) || adc < 0 || adc >= ADC_UNTOUCHED_THRESHOLD)
    return "Unavailable";
  if (status === "PASS" || status === "PASS_PROVISIONAL")
    return "14% or below";
  if (status === "FAIL" || status === "FAIL_PROVISIONAL")
    return "Above 14%";
  return "Unavailable";
}
