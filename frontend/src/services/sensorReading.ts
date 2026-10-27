import { decode } from "base-64";
import { ADC_THRESHOLD, BLE } from "../config/ble";

export function decodeSensorReading(value: string | null) {
  if (
    !value ||
    value.length > 64 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    throw new Error(
      "Invalid BLE value: expected a base64-encoded UTF-8 ADC integer.",
    );
  // Valid payloads contain ASCII digits, a strict subset of UTF-8.
  const text = decode(value).trim();
  if (!/^\d{1,4}$/.test(text))
    throw new Error("Invalid BLE value: expected an integer median ADC.");
  const medianAdc = Number(text);
  if (medianAdc > BLE.adcMax)
    throw new Error("Invalid BLE value: ADC must be between 0 and 4095.");
  return {
    medianAdc,
    provisionalStatus:
      medianAdc >= ADC_THRESHOLD ? ("PASS" as const) : ("FAIL" as const),
  };
}

export function provisionalLabel(status: "PASS" | "FAIL" | null | undefined) {
  return status === "PASS"
    ? "PASS / Below 14%"
    : status === "FAIL"
      ? "FAIL / 14% or Above"
      : "Awaiting valid reading";
}
