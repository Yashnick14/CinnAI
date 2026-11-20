import { CloudSensorService } from "./cloudSensor";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "./firebaseAuth";
import { BLE } from "../config/ble";
import { APP } from "../config/app";
import { RealBleService } from "./bleAdapter";
import { WifiSensorService } from "./wifiSensor";
import type { SensorService, SensorSnapshot } from "../types/sensor";

// Mock adapter implements the same lifecycle the future native BLE adapter will expose.
export class MockSensorService implements SensorService {
  private snapshot: SensorSnapshot = {
    state: "disconnected",
    isMock: true,
    device: null,
    devices: [],
    moisturePercent: null,
    updatedAt: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private interval?: ReturnType<typeof setInterval>;
  private pending?: {
    timer: ReturnType<typeof setTimeout>;
    finish: () => void;
  };

  /** Return the current state snapshot for subscribers. */
  getSnapshot = () => this.snapshot;

  /** Register a state listener and return its unsubscribe callback. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Merge a sensor state update and notify registered listeners. */
  protected set(patch: Partial<SensorSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  /** Cancel outstanding simulated operations and invalidate their generation. */
  private cancelPending() {
    this.generation++;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.finish();
      this.pending = undefined;
    }
    clearInterval(this.interval);
    this.interval = undefined;
  }

  /** Wait for the simulated sensor delay while respecting cancellation. */
  private wait(ms: number) {
    return new Promise<void>((resolve) => {
      this.pending = {
        timer: setTimeout(() => {
          this.pending = undefined;
          resolve();
        }, ms),
        finish: resolve,
      };
    });
  }

  /** Discover available sensors using the configured service implementation. */
  async scan() {
    this.disconnect();
    const generation = this.generation;
    this.set({ state: "scanning", devices: [], error: null });
    await this.wait(650);
    if (generation !== this.generation) return;
    this.set({
      state: "disconnected",
      devices: [{ id: "demo-esp32", name: "Cinnamon-ESP32 (Simulated)" }],
    });
  }

  /** Connect to the selected sensor and begin receiving its readings. */
  async connect(id: string) {
    this.cancelPending();
    const device = this.snapshot.devices.find((d) => d.id === id);
    if (!device) {
      this.set({
        state: "error",
        error: "Scan and select an available simulated sensor first.",
      });
      return;
    }
    const generation = this.generation;
    this.set({
      state: "connecting",
      error: null,
      moisturePercent: null,
      updatedAt: null,
    });
    await this.wait(550);
    if (generation !== this.generation) return;
    this.set({
      state: "connected",
      device,
      moisturePercent: 11.8,
      updatedAt: new Date().toISOString(),
    });
    this.interval = setInterval(() => {
      this.set({ moisturePercent: 11.8, updatedAt: new Date().toISOString() });
    }, 5000);
  }

  /** Stop active sensor work and clear the connection's current reading. */
  disconnect() {
    this.cancelPending();
    this.set({
      state: "disconnected",
      device: null,
      moisturePercent: null,
      updatedAt: null,
      error: null,
    });
  }

  /** Retry the service's selected or configured sensor connection. */
  async reconnect() {
    await this.scan();
    if (this.snapshot.devices[0]) await this.connect(this.snapshot.devices[0].id);
  }
  // Deliberate simulation controls, never exposed as actual sensor measurements.
  simulateFailure(kind: "disconnect" | "timeout") {
    if (kind === "disconnect") this.disconnect();
    else {
      this.cancelPending();
      this.set({
        state: "error",
        device: null,
        moisturePercent: null,
        updatedAt: null,
        error: "Simulated sensor: connection timed out. Scan or reconnect to retry.",
      });
    }
  }

  /** Release timers, subscriptions and service resources. */
  dispose() {
    this.cancelPending();
    this.listeners.clear();
  }
}

export const sensorService: SensorService =
  BLE.mode === "cloud"
    ? new CloudSensorService()
    : BLE.mode === "wifi"
      ? new WifiSensorService()
      : BLE.mode === "mock"
        ? new MockSensorService()
        : new RealBleService();

/** Return a usable moisture value only while the sensor reading is fresh. */
export function freshMoisture(
  snapshot: SensorSnapshot,
  now = Date.now(),
): number | null {
  if (snapshot.state !== "connected" || !snapshot.updatedAt) return null;
  const age = now - Date.parse(snapshot.updatedAt);
  return age >= 0 && age <= APP.sensorFreshnessMs ? snapshot.moisturePercent : null;
}

if (BLE.mode === "cloud") {
  onAuthStateChanged(firebaseAuth(), () => sensorService.disconnect());
}
