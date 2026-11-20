import { decode } from "base-64";
import { BLE, ADC_UNTOUCHED_THRESHOLD, adcScreeningStatus } from "../config/ble";

/** Decode and validate the raw ADC payload without inventing a moisture percentage. */
export function decodeSensorReading(value: string | null) {
  if (
    !value ||
    value.length > 64 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  )
    throw new Error("Invalid BLE value: expected a base64-encoded UTF-8 ADC integer.");
  // Valid payloads contain ASCII digits, a strict subset of UTF-8.
  const text = decode(value).trim();
  if (!/^\d{1,4}$/.test(text))
    throw new Error("Invalid BLE value: expected an integer median ADC.");
  const medianAdc = Number(text);
  if (medianAdc > BLE.adcMax)
    throw new Error("Invalid BLE value: ADC must be between 0 and 4095.");
  return {
    medianAdc,
    provisionalStatus: adcScreeningStatus(medianAdc),
  };
}

/** Format the provisional sensor compliance state for display. */
export function provisionalLabel(
  status: "PASS" | "FAIL" | null | undefined,
  adc?: number | null,
) {
  if (adc != null && adc >= ADC_UNTOUCHED_THRESHOLD)
    return "Untouched — place sensor against the quill";
  return status === "PASS"
    ? "PASS"
    : status === "FAIL"
      ? "FAIL"
      : "Awaiting valid reading";
}
