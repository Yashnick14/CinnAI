import { ADC_THRESHOLD, BLE } from "../config/ble";
import { SENSOR_WIFI } from "../config/sensorWifi";
import type { SensorService, SensorSnapshot } from "../types/sensor";

class SensorNetworkError extends Error {}

export function parseWifiReading(raw: unknown, receivedAt = Date.now()) {
  const r = raw as Record<string, unknown> | null;
  const current = !!r && Object.prototype.hasOwnProperty.call(r, "adc");
  const adc = current ? r?.adc : r?.median_adc;
  const status =
    typeof adc === "number" && adc >= ADC_THRESHOLD
      ? "PASS_PROVISIONAL"
      : "FAIL_PROVISIONAL";
  const invalid = (reason: string): never => {
    throw new Error(`Invalid or stale sensor response: ${reason}`);
  };
  if (!r || typeof r !== "object" || Array.isArray(r))
    invalid("expected a JSON object.");
  if (
    !Number.isInteger(adc) ||
    (adc as number) < 0 ||
    (adc as number) > BLE.adcMax
  )
    invalid("ADC must be an integer from 0 to 4095.");
  if (current) {
    if (r!.percentage !== null)
      invalid(
        "percentage must be null; no calibrated percentage is supported.",
      );
    if (r!.status !== status)
      invalid("status must match the provisional ADC threshold 2842.");
    if (r!.median_adc !== undefined && r!.median_adc !== adc)
      invalid("conflicting adc and median_adc values.");
  }
  if (
    !current &&
    (r!.device !== BLE.expectedDeviceName ||
      typeof r!.age_ms !== "number" ||
      !Number.isFinite(r!.age_ms) ||
      (r!.age_ms as number) < 0 ||
      (r!.age_ms as number) > SENSOR_WIFI.maxSampleAgeMs ||
      r!.threshold !== ADC_THRESHOLD ||
      r!.provisional !== true)
  )
    invalid(
      "legacy device/threshold/provisional metadata is invalid or age_ms is outside 0–10000 ms.",
    );
  const medianAdc = adc as number;
  return {
    medianAdc,
    provisionalStatus:
      medianAdc >= ADC_THRESHOLD ? ("PASS" as const) : ("FAIL" as const),
    updatedAt: new Date(
      receivedAt - (current ? 0 : (r!.age_ms as number)),
    ).toISOString(),
  };
}

// HTTP polling is local to the ESP32. It never calls the grading backend.
export class WifiSensorService implements SensorService {
  private snapshot: SensorSnapshot = {
    state: "disconnected",
    isMock: false,
    device: null,
    devices: [],
    moisturePercent: null,
    medianAdc: null,
    provisionalStatus: null,
    updatedAt: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private controller?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  constructor(
    private baseUrl = SENSOR_WIFI.baseUrl,
    private request: typeof fetch = (...args) => fetch(...args),
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private set(patch: Partial<SensorSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private cancel() {
    this.generation++;
    clearTimeout(this.timer);
    this.controller?.abort();
    this.controller = undefined;
  }
  private clearReading() {
    return {
      moisturePercent: null,
      medianAdc: null,
      provisionalStatus: null,
      updatedAt: null,
    };
  }
  private async read(token: number) {
    if (!/^https?:\/\/[^/]+$/.test(this.baseUrl))
      throw new Error(
        "Set EXPO_PUBLIC_SENSOR_WIFI_URL to the ESP32 base address, then restart Expo.",
      );
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), SENSOR_WIFI.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.request(`${this.baseUrl}/sensor`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
      } catch {
        throw new SensorNetworkError(
          controller.signal.aborted
            ? "Sensor request timed out."
            : "Cannot reach the ESP32 sensor.",
        );
      }
      // TEMPORARY diagnostics for real-world Wi-Fi firmware compatibility.
      console.info("[moisture:wifi] HTTP", response.status);
      const body = await response.text();
      const receivedAt = Date.now();
      console.info("[moisture:wifi] raw body", body);
      if (!response.ok)
        throw new Error(
          `ESP32 returned HTTP ${response.status}. Wait for a fresh sensor sample and retry.`,
        );
      let raw: unknown;
      try {
        raw = JSON.parse(body);
      } catch {
        if (controller.signal.aborted)
          throw new SensorNetworkError("Sensor request timed out.");
        throw new Error(
          "The ESP32 response could not be read. Reconnect and retry.",
        );
      }
      const result = parseWifiReading(raw, receivedAt);
      console.info("[moisture:wifi] parsed", {
        adc: result.medianAdc,
        status: `${result.provisionalStatus}_PROVISIONAL`,
        timestamp: result.updatedAt,
        readingAgeMs: Date.now() - Date.parse(result.updatedAt),
        reason: null,
      });
      if (token !== this.generation) return null;
      return result;
    } catch (error) {
      console.warn("[moisture:wifi] rejected", {
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.controller = undefined;
    }
  }
  async scan() {
    this.cancel();
    const token = this.generation;
    this.set({
      state: "scanning",
      devices: [],
      device: null,
      error: null,
      ...this.clearReading(),
    });
    try {
      if (!(await this.read(token)) || token !== this.generation) return;
      this.set({
        state: "disconnected",
        devices: [
          { id: this.baseUrl, name: `${BLE.expectedDeviceName} (Wi-Fi)` },
        ],
      });
    } catch (error) {
      if (token === this.generation) this.fail(error, "not_found");
    }
  }
  private fail(error: unknown, state: SensorSnapshot["state"]) {
    const message =
      error instanceof SensorNetworkError && state === "connection_lost"
        ? "Sensor connection lost. Check that the ESP32 is powered on and connected to the same Wi-Fi, then tap Reconnect."
        : `${error instanceof Error ? error.message : "Sensor request failed."} Check ESP32 power, its IP address, and that your iPhone is on the same Wi-Fi. Use http:// for the ESP32 endpoint.`;
    this.cancel();
    this.set({
      state,
      device: null,
      ...this.clearReading(),
      error: message,
    });
  }
  private async poll(token: number) {
    try {
      const reading = await this.read(token);
      if (!reading || token !== this.generation) return;
      this.set({
        state: "connected",
        device: { id: this.baseUrl, name: `${BLE.expectedDeviceName} (Wi-Fi)` },
        ...reading,
        moisturePercent: null,
        error: null,
      });
      this.timer = setTimeout(() => void this.poll(token), SENSOR_WIFI.pollMs);
    } catch (error) {
      if (token === this.generation)
        this.fail(
          error,
          this.snapshot.state === "connected" ? "connection_lost" : "error",
        );
    }
  }
  async connect(id: string) {
    if (id !== this.baseUrl) {
      this.fail(new Error("Select the configured Wi-Fi sensor."), "error");
      return;
    }
    this.cancel();
    const token = this.generation;
    this.set({
      state: "connecting",
      device: null,
      error: null,
      ...this.clearReading(),
    });
    await this.poll(token);
  }
  disconnect() {
    this.cancel();
    this.set({
      state: "disconnected",
      device: null,
      error: null,
      ...this.clearReading(),
    });
  }
  async reconnect() {
    await this.connect(this.baseUrl);
  }
  dispose() {
    this.disconnect();
    this.disposed = true;
    this.listeners.clear();
  }
}
