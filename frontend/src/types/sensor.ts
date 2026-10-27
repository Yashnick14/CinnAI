export type SensorState =
  | "disconnected"
  | "scanning"
  | "connecting"
  | "connected"
  | "error"
  | "bluetooth_off"
  | "permission_denied"
  | "not_found"
  | "connection_lost";
export interface SensorDevice {
  id: string;
  name: string;
}
export interface SensorSnapshot {
  state: SensorState;
  isMock: boolean;
  device: SensorDevice | null;
  devices: SensorDevice[];
  moisturePercent: number | null;
  medianAdc?: number | null;
  provisionalStatus?: "PASS" | "FAIL" | null;
  stale?: boolean;
  updatedAt: string | null;
  error: string | null;
}
export interface SensorService {
  getSnapshot(): SensorSnapshot;
  subscribe(listener: () => void): () => void;
  scan(): Promise<void>;
  connect(id: string): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;
  dispose(): void;
}
