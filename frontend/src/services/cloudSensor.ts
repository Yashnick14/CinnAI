import { z } from "zod";
import { BLE, adcScreeningStatus } from "../config/ble";
import type { SensorService, SensorSnapshot } from "../types/sensor";
import { cloudRequest, cloudUid } from "./cloudApi";

export const CloudDevices = z.array(
  z.object({ id: z.string(), name: z.string(), revoked: z.boolean() }),
);
const Reading = z.object({
  id: z.string(),
  device_id: z.string(),
  adc: z.number().int().min(0).max(4095),
  percentage: z.null(),
  status: z.enum(["PASS_PROVISIONAL", "FAIL_PROVISIONAL", "UNTOUCHED"]),
  received_at: z.string().datetime({ offset: true }),
  server_time: z.string().datetime({ offset: true }),
  age_ms: z.number().nonnegative(),
  stale: z.boolean(),
});
const Latest = z.object({
  state: z.enum(["available", "missing", "revoked"]),
  reading: Reading.nullable(),
});

/** Validate device identity, ADC/status consistency and server-reported reading freshness. */
export function parseCloudReading(raw: unknown, deviceId: string) {
  const value = Latest.parse(raw);
  if (!value.reading || value.state !== "available")
    throw new Error("Moisture reading unavailable. Check sensor power and internet.");
  const r = value.reading;
  if (
    r.device_id !== deviceId ||
    r.status !==
      (adcScreeningStatus(r.adc)
        ? `${adcScreeningStatus(r.adc)}_PROVISIONAL`
        : "UNTOUCHED")
  )
    throw new Error("Invalid cloud sensor response.");
  return {
    medianAdc: r.adc,
    provisionalStatus: adcScreeningStatus(r.adc),
    updatedAt: r.received_at,
    stale: r.stale || r.age_ms > BLE.readingFreshnessMs,
  };
}
export class CloudSensorService implements SensorService {
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
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private generation = 0;
  private selected: string | null = null;
  private pollIntervalMs = 2000;

  /** Speed up visible live readings without restarting or overlapping requests. */
  setLiveViewActive(active: boolean) {
    this.pollIntervalMs = active ? 1000 : 2000;
  }

  /** Initialize the service with its configured dependencies. */
  constructor(
    private request = cloudRequest,
    private uid = cloudUid,
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
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  /** Cancel the current asynchronous operation and its pending work. */
  private cancel() {
    this.generation++;
    clearTimeout(this.timer);
    this.controller?.abort();
  }
  private cleared = {
    medianAdc: null,
    provisionalStatus: null,
    updatedAt: null,
    moisturePercent: null,
    stale: false,
  };

  /** List non-revoked devices owned by the signed-in account, ignoring superseded requests. */
  async scan() {
    this.cancel();
    const generation = this.generation;
    const owner = this.uid();
    this.set({
      state: "scanning",
      devices: [],
      device: null,
      error: null,
      ...this.cleared,
    });
    try {
      const devices = CloudDevices.parse(
        await this.request("/devices", {}, owner),
      ).filter((d) => !d.revoked);
      if (generation !== this.generation || owner !== this.uid()) return;
      this.set({
        devices,
        state: devices.length ? "disconnected" : "not_found",
        error: devices.length ? null : "Pair your device using its USB pairing code.",
      });
    } catch (e) {
      if (generation === this.generation)
        this.set({ state: "error", error: String(e instanceof Error ? e.message : e) });
    }
  }

  /** Submit a temporary pairing code and refresh the account's device list. */
  async pair(code: string) {
    await this.request("/devices/pair", {
      method: "POST",
      body: JSON.stringify({ code: code.trim().toLowerCase() }),
    });
    await this.scan();
  }

  /** Revoke the selected device credential, disconnect and refresh available devices. */
  async revoke() {
    if (!this.selected) return;
    await this.request(`/devices/${encodeURIComponent(this.selected)}/revoke`, {
      method: "POST",
    });
    this.disconnect();
    await this.scan();
  }

  /** Release the selected device from the account and refresh available devices. */
  async unpair() {
    if (!this.selected) return;
    await this.request(`/devices/${encodeURIComponent(this.selected)}/unpair`, {
      method: "POST",
    });
    this.disconnect();
    await this.scan();
  }

  /** Connect to the selected sensor and begin receiving its readings. */
  async connect(id: string) {
    this.cancel();
    this.selected = id;
    const generation = this.generation;
    const owner = this.uid();
    this.set({ state: "connecting", device: null, error: null, ...this.cleared });
    await this.poll(generation, owner, id);
  }

  /** Fetch the next sensor reading while rejecting results from an obsolete connection. */
  private async poll(generation: number, owner: string | null, id: string) {
    if (generation !== this.generation) return;
    if (!owner || owner !== this.uid()) {
      this.disconnect();
      return;
    }
    this.controller = new AbortController();
    try {
      const reading = parseCloudReading(
        await this.request(
          `/devices/${encodeURIComponent(id)}/latest`,
          { signal: this.controller.signal },
          owner,
        ),
        id,
      );
      if (generation !== this.generation || owner !== this.uid()) return;
      this.set({
        ...reading,
        state: "connected",
        device: { id, name: "CinnamonGradingSensor (Cloud)" },
        error: reading.stale
          ? "Moisture reading unavailable: sensor reading is stale."
          : null,
      });
    } catch (e) {
      if (generation !== this.generation) return;
      this.set({
        ...this.cleared,
        state: "connection_lost",
        device: null,
        error: e instanceof Error ? e.message : "Moisture reading unavailable.",
      });
    }
    if (generation === this.generation)
      this.timer = setTimeout(
        () => void this.poll(generation, owner, id),
        this.pollIntervalMs,
      );
  }

  /** Stop active sensor work and clear the connection's current reading. */
  disconnect() {
    this.cancel();
    this.selected = null;
    this.set({
      ...this.cleared,
      state: "disconnected",
      devices: [],
      device: null,
      error: null,
    });
  }

  /** Retry the service's selected or configured sensor connection. */
  async reconnect() {
    if (this.selected) await this.connect(this.selected);
    else await this.scan();
  }

  /** Release timers, subscriptions and service resources. */
  dispose() {
    this.disconnect();
    this.listeners.clear();
  }
}
