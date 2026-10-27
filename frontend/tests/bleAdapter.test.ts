import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { encode } from "base-64";
import type { BleManager, Device } from "react-native-ble-plx";
import { BLE } from "../src/config/ble";
import { RealBleService } from "../src/services/bleAdapter.native";

type Callback = (...args: any[]) => void;
function setup(state = "PoweredOn", granted = true) {
  let scanned: Callback = () => {};
  let notify: Callback = () => {};
  let lost: Callback = () => {};
  const stateListeners = new Set<Callback>();
  const removals: ReturnType<typeof vi.fn>[] = [];
  function subscription() {
    const remove = vi.fn();
    removals.push(remove);
    return { remove };
  }
  const device = {
    id: "esp32",
    name: BLE.expectedDeviceName,
    discoverAllServicesAndCharacteristics: vi.fn(async () => device),
    characteristicsForService: vi.fn(async () => [
      { uuid: BLE.moistureCharacteristicUuid, isNotifiable: true },
    ]),
    monitorCharacteristicForService: vi.fn((_service, _char, cb: Callback) => {
      notify = cb;
      return subscription();
    }),
  };
  const manager = {
    onStateChange: vi.fn((cb: Callback, emit: boolean) => {
      stateListeners.add(cb);
      if (emit) cb(state);
      return { remove: () => stateListeners.delete(cb) };
    }),
    startDeviceScan: vi.fn((_filter, _options, cb: Callback) => {
      scanned = cb;
    }),
    stopDeviceScan: vi.fn(),
    connectToDevice: vi.fn(async () => device),
    onDeviceDisconnected: vi.fn((_id, cb: Callback) => {
      lost = cb;
      return subscription();
    }),
    cancelDeviceConnection: vi.fn(async () => device),
    destroy: vi.fn(),
  };
  const permission = vi.fn(async () => granted);
  const sensor = new RealBleService(async () => ({
    manager: manager as unknown as BleManager,
    permission,
  }));
  async function discover() {
    const scan = sensor.scan();
    await vi.advanceTimersByTimeAsync(0);
    scanned(null, device);
    await scan;
  }
  return {
    sensor,
    manager,
    device,
    removals,
    discover,
    scanned: (...args: any[]) => scanned(...args),
    notify: (value: string | null) => notify(null, { value }),
    lost: () => lost(null),
    state: (next: string) => [...stateListeners].forEach((cb) => cb(next)),
  };
}
const sensors: RealBleService[] = [];
function tracked(state?: string, permission?: boolean) {
  const fixture = setup(state, permission);
  sensors.push(fixture.sensor);
  return fixture;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  sensors.splice(0).forEach((sensor) => sensor.dispose());
  vi.useRealTimers();
});

it("discovers exact name, discovers characteristic, subscribes, and receives ADC without a percent", async () => {
  const f = tracked();
  await f.discover();
  await f.sensor.connect("esp32");
  expect(f.device.characteristicsForService).toHaveBeenCalledWith(
    BLE.serviceUuid,
  );
  expect(f.device.monitorCharacteristicForService).toHaveBeenCalledWith(
    BLE.serviceUuid,
    BLE.moistureCharacteristicUuid,
    expect.any(Function),
  );
  f.notify(encode("2903"));
  expect(f.sensor.getSnapshot()).toMatchObject({
    state: "connected",
    medianAdc: 2903,
    provisionalStatus: "PASS",
    moisturePercent: null,
    error: null,
  });
  expect(f.sensor.getSnapshot().updatedAt).not.toBeNull();
});
it("clears invalid readings and recovers on the next valid notification", async () => {
  const f = tracked();
  await f.discover();
  await f.sensor.connect("esp32");
  f.notify(encode("2903"));
  f.notify(encode("bad"));
  expect(f.sensor.getSnapshot()).toMatchObject({
    state: "connected",
    medianAdc: null,
    updatedAt: null,
  });
  expect(f.sensor.getSnapshot().error).toContain("Invalid BLE value");
  f.notify(encode("2841"));
  expect(f.sensor.getSnapshot()).toMatchObject({
    medianAdc: 2841,
    provisionalStatus: "FAIL",
    error: null,
  });
});
it.each([
  ["PoweredOff", "bluetooth_off"],
  ["Unauthorized", "permission_denied"],
  ["Unsupported", "error"],
])("handles %s", async (state, expected) => {
  const f = tracked(state);
  await f.sensor.scan();
  expect(f.sensor.getSnapshot().state).toBe(expected);
  expect(f.manager.startDeviceScan).not.toHaveBeenCalled();
});
it("handles denied Android permission", async () => {
  const f = tracked("PoweredOn", false);
  await f.sensor.scan();
  expect(f.sensor.getSnapshot().state).toBe("permission_denied");
});
it("ignores other devices and reports not found after scan timeout", async () => {
  const f = tracked();
  const pending = f.sensor.scan();
  await vi.advanceTimersByTimeAsync(0);
  f.scanned(null, { id: "other", name: "OtherSensor" });
  await vi.advanceTimersByTimeAsync(BLE.scanTimeoutMs);
  await pending;
  expect(f.sensor.getSnapshot().state).toBe("not_found");
  expect(f.manager.stopDeviceScan).toHaveBeenCalled();
});
it("clears readings on connection loss and reconnects with a new subscription", async () => {
  const f = tracked();
  await f.discover();
  await f.sensor.connect("esp32");
  f.notify(encode("2903"));
  f.lost();
  expect(f.sensor.getSnapshot()).toMatchObject({
    state: "connection_lost",
    medianAdc: null,
    updatedAt: null,
  });
  const reconnect = f.sensor.reconnect();
  await vi.advanceTimersByTimeAsync(0);
  f.scanned(null, f.device);
  await reconnect;
  expect(f.sensor.getSnapshot().state).toBe("connected");
  expect(f.device.monitorCharacteristicForService).toHaveBeenCalledTimes(2);
});
it("handles Bluetooth being switched off after connecting", async () => {
  const f = tracked();
  await f.discover();
  await f.sensor.connect("esp32");
  f.state("PoweredOff");
  expect(f.sensor.getSnapshot()).toMatchObject({
    state: "bluetooth_off",
    medianAdc: null,
  });
});
it("removes subscriptions on manual disconnect and ignores late notifications", async () => {
  const f = tracked();
  await f.discover();
  await f.sensor.connect("esp32");
  f.sensor.disconnect();
  f.notify(encode("2903"));
  expect(f.sensor.getSnapshot()).toMatchObject({
    state: "disconnected",
    medianAdc: null,
  });
  f.removals.forEach((remove) => expect(remove).toHaveBeenCalled());
});
it("bounds connection and discovery time", async () => {
  const f = tracked();
  await f.discover();
  f.manager.connectToDevice.mockImplementationOnce(() => new Promise(() => {}));
  const pending = f.sensor.connect("esp32");
  await vi.advanceTimersByTimeAsync(BLE.connectTimeoutMs + 1);
  await pending;
  expect(f.sensor.getSnapshot().state).toBe("error");
  expect(f.sensor.getSnapshot().error).toContain("timed out");
});
it("handles missing notification characteristic", async () => {
  const f = tracked();
  await f.discover();
  f.device.characteristicsForService.mockResolvedValueOnce([]);
  await f.sensor.connect("esp32");
  expect(f.sensor.getSnapshot().error).toContain("missing");
});
it("reports a missing development build without crashing mock imports", async () => {
  const service = new RealBleService(async () => {
    throw new Error("Development Build required");
  });
  sensors.push(service);
  await service.scan();
  expect(service.getSnapshot().error).toContain("Development Build");
});
it("cancels scans without later not-found errors", async () => {
  const f = tracked();
  const scan = f.sensor.scan();
  await vi.advanceTimersByTimeAsync(0);
  f.sensor.disconnect();
  await scan;
  await vi.advanceTimersByTimeAsync(BLE.scanTimeoutMs);
  expect(f.sensor.getSnapshot().state).toBe("disconnected");
});
