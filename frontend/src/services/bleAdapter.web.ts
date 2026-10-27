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
  getSnapshot = () => this.snapshot;
  subscribe = (_listener: () => void) => () => {};
  async scan() {}
  async connect(_id: string) {}
  disconnect() {}
  async reconnect() {}
  dispose() {}
}
