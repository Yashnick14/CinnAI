import { useEffect, useState, useSyncExternalStore } from "react";
import { sensorService } from "../services/ble";
import { BLE } from "../config/ble";
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
    scan: () => sensorService.scan(),
    connect: (id: string) => sensorService.connect(id),
    disconnect: () => sensorService.disconnect(),
    reconnect: () => sensorService.reconnect(),
  };
}
