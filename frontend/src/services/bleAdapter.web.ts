import type { SensorService, SensorSnapshot } from "../types/sensor";

export class RealBleService implements SensorService {
  private snapshot: SensorSnapshot = {
    state: "error",
    isMock: false,
    device: null,
    devices: [],
    moisturePercent: null,
    medianAdc: null,
    provisionalStatus: null,
    updatedAt: null,
    error:
      "Real BLE requires a physical phone with an Expo Development Build. Use mock sensor mode for browser testing.",
  };

  /** Return the unsupported-browser BLE state. */
  getSnapshot = () => this.snapshot;

  /** Keep the sensor interface available without attempting native BLE in a browser. */
  subscribe = (_listener: () => void) => () => {};

  /** Keep the sensor interface available without attempting native BLE in a browser. */
  async scan() {}

  /** Keep the sensor interface available without attempting native BLE in a browser. */
  async connect(_id: string) {}

  /** Keep the sensor interface available without attempting native BLE in a browser. */
  disconnect() {}

  /** Keep the sensor interface available without attempting native BLE in a browser. */
  async reconnect() {}

  /** Keep the sensor interface available without attempting native BLE in a browser. */
  dispose() {}
}
