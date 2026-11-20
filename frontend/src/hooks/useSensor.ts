import { useEffect, useState, useSyncExternalStore } from "react";
import { sensorService } from "../services/ble";
import { BLE } from "../config/ble";

/** Subscribe the screen to the shared sensor service and expose connection actions. */
export function useSensor() {
  const sensor = useSyncExternalStore(
    sensorService.subscribe,
    sensorService.getSnapshot,
    sensorService.getSnapshot,
  );
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const age = sensor.updatedAt ? now - Date.parse(sensor.updatedAt) : Infinity;
  const stale =
    !sensor.isMock &&
    sensor.medianAdc != null &&
    (age > BLE.readingFreshnessMs || age < -1000);
  return {
    ...sensor,
    stale,

    /** Discover available sensors using the configured service implementation. */
    scan: () => sensorService.scan(),

    /** Connect to the selected sensor and begin receiving its readings. */
    connect: (id: string) => sensorService.connect(id),

    /** Stop active sensor work and clear the connection's current reading. */
    disconnect: () => sensorService.disconnect(),

    /** Retry the service's selected or configured sensor connection. */
    reconnect: () => sensorService.reconnect(),
  };
}
