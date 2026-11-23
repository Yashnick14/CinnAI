import { ADC_THRESHOLD, BLE, adcScreeningStatus } from "../config/ble";
import { SENSOR_WIFI } from "../config/sensorWifi";
import type { SensorService, SensorSnapshot } from "../types/sensor";

class SensorNetworkError extends Error {}

/** Validate supported ESP32 JSON formats and timestamp accepted readings using phone receipt time. */
export function parseWifiReading(raw: unknown, receivedAt = Date.now()) {
  const r = raw as Record<string, unknown> | null;
  const current = !!r && Object.prototype.hasOwnProperty.call(r, "adc");
  const adc = current ? r?.adc : r?.median_adc;
  const status =
    typeof adc === "number" && adcScreeningStatus(adc)
      ? `${adcScreeningStatus(adc)}_PROVISIONAL`
      : "UNTOUCHED";

  /** Reject a malformed or stale sensor response with an explicit reason. */
  const invalid = (reason: string): never => {
    throw new Error(`Invalid or stale sensor response: ${reason}`);
  };
  if (!r || typeof r !== "object" || Array.isArray(r))
    invalid("expected a JSON object.");
  if (!Number.isInteger(adc) || (adc as number) < 0 || (adc as number) > BLE.adcMax)
    invalid("ADC must be an integer from 0 to 4095.");
  if (current) {
    if (r!.percentage !== null)
      invalid("percentage must be null; no calibrated percentage is supported.");
    if (r!.status !== status)
      invalid("status must match the configured ADC screening thresholds.");
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
    provisionalStatus: adcScreeningStatus(medianAdc),
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

  /** Initialize the service with its configured dependencies. */
  constructor(
    private baseUrl = SENSOR_WIFI.baseUrl,
    private request: typeof fetch = (...args) => fetch(...args),
  ) {}

  /** Return the current state snapshot for subscribers. */
  getSnapshot = () => this.snapshot;

  /** Register a state listener and return its unsubscribe callback. */
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  /** Merge a sensor state update and notify registered listeners. */
  private set(patch: Partial<SensorSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  /** Cancel the current asynchronous operation and its pending work. */
  private cancel() {
    this.generation++;
    clearTimeout(this.timer);
    this.controller?.abort();
    this.controller = undefined;
  }

  /** Return the empty reading fields used after disconnection or invalid data. */
  private clearReading() {
    return {
      moisturePercent: null,
      medianAdc: null,
      provisionalStatus: null,
      updatedAt: null,
    };
  }

  /** Fetch and validate the local ESP32 reading with a bounded request timeout. */
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
      // Diagnostics for Wi-Fi firmware compatibility.
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
        throw new Error("The ESP32 response could not be read. Reconnect and retry.");
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

  /** Probe the configured ESP32 HTTP endpoint and advertise it only after a valid response. */
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
        devices: [{ id: this.baseUrl, name: `${BLE.expectedDeviceName} (Wi-Fi)` }],
      });
    } catch (error) {
      if (token === this.generation) this.fail(error, "not_found");
    }
  }

  /** Clear unusable readings and publish the sensor failure state. */
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

  /** Fetch the next sensor reading while rejecting results from an obsolete connection. */
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

  /** Connect to the selected sensor and begin receiving its readings. */
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

  /** Stop active sensor work and clear the connection's current reading. */
  disconnect() {
    this.cancel();
    this.set({
      state: "disconnected",
      device: null,
      error: null,
      ...this.clearReading(),
    });
  }

  /** Retry the service's selected or configured sensor connection. */
  async reconnect() {
    await this.connect(this.baseUrl);
  }

  /** Release timers, subscriptions and service resources. */
  dispose() {
    this.disconnect();
    this.disposed = true;
    this.listeners.clear();
  }
}
