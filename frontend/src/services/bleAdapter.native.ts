import type { BleManager, Device, Subscription } from "react-native-ble-plx";
import { BLE } from "../config/ble";
import type { SensorService, SensorSnapshot } from "../types/sensor";
import { decodeSensorReading } from "./sensorReading";

type Runtime = { manager: BleManager; permission: () => Promise<boolean> };
async function nativeRuntime(): Promise<Runtime> {
  const { NativeModules, PermissionsAndroid, Platform } =
    await import("react-native");
  if (!NativeModules.BlePlx)
    throw new Error(
      "Bluetooth requires a new Expo Development Build with react-native-ble-plx. Expo Go is not supported.",
    );
  const { BleManager } = await import("react-native-ble-plx");
  return {
    manager: new BleManager(),
    permission: async () => {
      if (Platform.OS !== "android") return true;
      const permissions =
        Number(Platform.Version) >= 31
          ? [
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]
          : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const result = await PermissionsAndroid.requestMultiple(permissions);
      return permissions.every(
        (key) => result[key] === PermissionsAndroid.RESULTS.GRANTED,
      );
    },
  };
}

export class RealBleService implements SensorService {
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
  private runtime?: Promise<Runtime>;
  private manager?: BleManager;
  private generation = 0;
  private subscriptions: Subscription[] = [];
  private scanTimer?: ReturnType<typeof setTimeout>;
  private finishScan?: () => void;
  private cancelReady?: () => void;
  private currentId?: string;
  private disposed = false;
  constructor(private loadRuntime = nativeRuntime) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(patch: Partial<SensorSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private clearReading() {
    return {
      medianAdc: null,
      provisionalStatus: null,
      moisturePercent: null,
      updatedAt: null,
    };
  }
  private stopScan() {
    clearTimeout(this.scanTimer);
    this.scanTimer = undefined;
    if (this.manager)
      void Promise.resolve(this.manager.stopDeviceScan()).catch(() => {});
    this.finishScan?.();
    this.finishScan = undefined;
  }
  private cleanup() {
    this.generation++;
    this.cancelReady?.();
    this.cancelReady = undefined;
    this.stopScan();
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];
    const id = this.currentId;
    this.currentId = undefined;
    if (id) void this.manager?.cancelDeviceConnection(id).catch(() => {});
  }
  private fail(error: unknown, state: SensorSnapshot["state"] = "error") {
    this.cleanup();
    const code = (error as { errorCode?: number })?.errorCode;
    if (code === 101) state = "permission_denied";
    if (code === 102) state = "bluetooth_off";
    this.set({
      state,
      device: null,
      ...this.clearReading(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
  private async ready(token: number) {
    if (!this.runtime)
      this.runtime = this.loadRuntime().catch((error) => {
        this.runtime = undefined;
        throw error;
      });
    const runtime = await this.runtime;
    if (token !== this.generation || this.disposed) return null;
    this.manager = runtime.manager;
    if (!(await runtime.permission())) {
      this.fail(
        new Error(
          "Bluetooth permission denied. Enable Bluetooth access for CinnAI in Settings, then retry.",
        ),
        "permission_denied",
      );
      return null;
    }
    if (token !== this.generation) return null;
    const state = await new Promise<string>((resolve) => {
      let sub: Subscription | undefined;
      let done = false;
      const finish = (state: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        sub?.remove();
        this.cancelReady = undefined;
        resolve(state);
      };
      const timer = setTimeout(() => finish("Unknown"), BLE.stateTimeoutMs);
      this.cancelReady = () => finish("Cancelled");
      sub = runtime.manager.onStateChange((state) => {
        if (state !== "Unknown" && state !== "Resetting") finish(state);
      }, true);
      if (done) sub.remove();
    });
    if (token !== this.generation) return null;
    if (state !== "PoweredOn") {
      this.fail(
        new Error(
          state === "Unauthorized"
            ? "Bluetooth permission denied. Enable Bluetooth access in Settings."
            : state === "PoweredOff"
              ? "Bluetooth is off. Turn it on in Settings, then retry."
              : "Bluetooth is unavailable or did not become ready. Retry on a physical device.",
        ),
        state === "Unauthorized"
          ? "permission_denied"
          : state === "PoweredOff"
            ? "bluetooth_off"
            : "error",
      );
      return null;
    }
    this.subscriptions.push(
      runtime.manager.onStateChange((state) => {
        if (token === this.generation && state === "PoweredOff")
          this.fail(
            new Error("Bluetooth is off. Turn it on, then reconnect."),
            "bluetooth_off",
          );
        if (token === this.generation && state === "Unauthorized")
          this.fail(
            new Error(
              "Bluetooth permission denied. Enable access in Settings.",
            ),
            "permission_denied",
          );
      }, false),
    );
    return runtime.manager;
  }
  async scan() {
    this.cleanup();
    const token = this.generation;
    this.set({
      state: "scanning",
      device: null,
      devices: [],
      error: null,
      ...this.clearReading(),
    });
    try {
      const manager = await this.ready(token);
      if (!manager || token !== this.generation) return;
      await new Promise<void>((resolve) => {
        this.finishScan = resolve;
        this.scanTimer = setTimeout(() => {
          if (token === this.generation)
            this.fail(
              new Error(
                `Device not found. Power on ${BLE.expectedDeviceName}, move closer, and make sure another app is not connected.`,
              ),
              "not_found",
            );
        }, BLE.scanTimeoutMs);
        // Name matching also supports firmware that omits the service from advertising.
        const starting = manager.startDeviceScan(
          null,
          null,
          (error, device) => {
            if (token !== this.generation) return;
            if (error) {
              this.fail(error);
              return;
            }
            if (
              device &&
              (device.name === BLE.expectedDeviceName ||
                device.localName === BLE.expectedDeviceName)
            ) {
              this.stopScan();
              this.set({
                state: "disconnected",
                devices: [{ id: device.id, name: BLE.expectedDeviceName }],
              });
            }
          },
        );
        void Promise.resolve(starting).catch((error) => {
          if (token === this.generation) this.fail(error);
        });
      });
    } catch (error) {
      if (token === this.generation) this.fail(error);
    }
  }
  async connect(id: string) {
    if (!this.snapshot.devices.some((d) => d.id === id)) {
      this.fail(new Error("Scan and select CinnamonGradingSensor first."));
      return;
    }
    this.cleanup();
    const token = this.generation;
    this.currentId = id;
    this.set({
      state: "connecting",
      error: null,
      device: null,
      ...this.clearReading(),
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const manager = await this.ready(token);
      if (!manager || token !== this.generation) return;
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Sensor connection/discovery timed out. Reconnect to retry.",
              ),
            ),
          BLE.connectTimeoutMs,
        );
      });
      const connection = (async () => {
        let device: Device = await manager.connectToDevice(id, {
          timeout: BLE.connectTimeoutMs,
        });
        if (token !== this.generation) {
          if (this.currentId !== id)
            void manager.cancelDeviceConnection(id).catch(() => {});
          return;
        }
        this.subscriptions.push(
          manager.onDeviceDisconnected(id, () => {
            if (token === this.generation)
              this.fail(
                new Error(
                  "Sensor connection lost. Move closer, check ESP32 power, then reconnect.",
                ),
                "connection_lost",
              );
          }),
        );
        device = await device.discoverAllServicesAndCharacteristics();
        if (token !== this.generation) return;
        const characteristics = await device.characteristicsForService(
          BLE.serviceUuid,
        );
        if (token !== this.generation) return;
        const characteristic = characteristics.find(
          (c) => c.uuid.toLowerCase() === BLE.moistureCharacteristicUuid,
        );
        if (
          !characteristic ||
          (!characteristic.isNotifiable && !characteristic.isIndicatable)
        )
          throw new Error(
            "ESP32 moisture characteristic is missing or does not support notifications.",
          );
        this.set({
          state: "connected",
          device: { id, name: BLE.expectedDeviceName },
          error: null,
        });
        this.subscriptions.push(
          device.monitorCharacteristicForService(
            BLE.serviceUuid,
            BLE.moistureCharacteristicUuid,
            (error, characteristic) => {
              if (token !== this.generation) return;
              if (error) {
                this.fail(error, "connection_lost");
                return;
              }
              try {
                const reading = decodeSensorReading(
                  characteristic?.value ?? null,
                );
                this.set({
                  ...reading,
                  moisturePercent: null,
                  updatedAt: new Date().toISOString(),
                  error: null,
                });
              } catch (error) {
                this.set({
                  ...this.clearReading(),
                  error:
                    error instanceof Error
                      ? error.message
                      : "Invalid BLE value.",
                });
              }
            },
          ),
        );
      })();
      await Promise.race([connection, deadline]);
    } catch (error) {
      if (token === this.generation) this.fail(error);
    } finally {
      clearTimeout(timer);
    }
  }
  disconnect() {
    this.cleanup();
    this.set({
      state: "disconnected",
      device: null,
      error: null,
      ...this.clearReading(),
    });
  }
  async reconnect() {
    await this.scan();
    const device = this.snapshot.devices[0];
    if (device && this.snapshot.state === "disconnected")
      await this.connect(device.id);
  }
  dispose() {
    this.cleanup();
    this.disposed = true;
    this.listeners.clear();
    if (this.runtime)
      void this.runtime
        .then(({ manager }) => manager.destroy())
        .catch(() => {});
  }
}
