import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  WifiSensorService,
  parseWifiReading,
} from "../src/services/wifiSensor";
import { SENSOR_WIFI } from "../src/config/sensorWifi";
import { snapshotMoisture } from "../src/services/sessionMoisture";

const payload = {
  device: "CinnamonGradingSensor",
  median_adc: 2903,
  age_ms: 100,
  threshold: 2842,
  provisional: true,
};
const services: WifiSensorService[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  services.splice(0).forEach((service) => service.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function setup() {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(JSON.stringify(payload)));
  const service = new WifiSensorService("http://192.168.10.126", fetcher);
  services.push(service);
  return { service, fetcher };
}
it.each([
  [2910, "PASS_PROVISIONAL"],
  [2842, "PASS_PROVISIONAL"],
  [2841, "FAIL_PROVISIONAL"],
] as const)(
  "accepts current firmware ADC %d at phone receipt time",
  (adc, status) => {
    const reading = parseWifiReading({ adc, percentage: null, status });
    expect(reading.medianAdc).toBe(adc);
    expect(reading.provisionalStatus + "_PROVISIONAL").toBe(status);
    expect(Date.parse(reading.updatedAt)).toBe(Date.now());
  },
);
it.each([
  { adc: "2910", percentage: null, status: "PASS_PROVISIONAL" },
  { adc: 2910.5, percentage: null, status: "PASS_PROVISIONAL" },
  { adc: 4096, percentage: null, status: "PASS_PROVISIONAL" },
  { adc: 2910, percentage: 11.8, status: "PASS_PROVISIONAL" },
  { adc: 2910, percentage: null, status: "FAIL_PROVISIONAL" },
  { adc: 2910, percentage: null, status: "PASS" },
])("rejects invalid current firmware payload %j", (raw) => {
  expect(() => parseWifiReading(raw)).toThrow("Invalid or stale");
});
it("refreshes timestamps on 2-second polling and preserves 30-second session protection", async () => {
  const { service, fetcher } = setup();
  const raw = { adc: 2910, percentage: null, status: "PASS_PROVISIONAL" };
  fetcher.mockImplementation(async () => new Response(JSON.stringify(raw)));
  await service.reconnect();
  const first = service.getSnapshot().updatedAt;
  await vi.advanceTimersByTimeAsync(2000);
  const current = service.getSnapshot();
  expect(Date.parse(current.updatedAt!) - Date.parse(first!)).toBe(2000);
  expect(snapshotMoisture(current)).toMatchObject({
    read_status: "fresh",
    status: "PASS_PROVISIONAL",
    percentage: null,
  });
  expect(snapshotMoisture(current, Date.now() + 30000).read_status).toBe(
    "fresh",
  );
  expect(snapshotMoisture(current, Date.now() + 30001)).toMatchObject({
    read_status: "stale",
    status: "UNAVAILABLE",
  });
  expect(console.info).toHaveBeenCalledWith("[moisture:wifi] HTTP", 200);
  expect(console.info).toHaveBeenCalledWith(
    "[moisture:wifi] raw body",
    JSON.stringify(raw),
  );
  expect(console.info).toHaveBeenCalledWith(
    "[moisture:wifi] parsed",
    expect.objectContaining({
      adc: 2910,
      status: "PASS_PROVISIONAL",
      readingAgeMs: 0,
    }),
  );
});
it.each([
  [2842, "PASS"],
  [2841, "FAIL"],
  [2903, "PASS"],
])("classifies ADC %d without inventing a percentage", (adc, status) => {
  const reading = parseWifiReading({ ...payload, median_adc: adc });
  expect(reading).toMatchObject({ medianAdc: adc, provisionalStatus: status });
  expect(reading).not.toHaveProperty("moisturePercent");
  expect(Date.parse(reading.updatedAt)).toBe(Date.now() - 100);
});
it.each([
  null,
  {},
  { ...payload, device: "wrong" },
  { ...payload, median_adc: "2903" },
  { ...payload, median_adc: 4096 },
  { ...payload, median_adc: -1 },
  { ...payload, median_adc: 2903.5 },
  { ...payload, age_ms: 10001 },
  { ...payload, age_ms: -1 },
  { ...payload, threshold: 3000 },
  { ...payload, provisional: false },
])("rejects invalid or stale responses", (raw) => {
  expect(() => parseWifiReading(raw)).toThrow("Invalid or stale");
});
it("finds the configured ESP32, polls without overlap, and disconnects", async () => {
  const { service, fetcher } = setup();
  await service.scan();
  expect(service.getSnapshot().devices).toEqual([
    { id: "http://192.168.10.126", name: "CinnamonGradingSensor (Wi-Fi)" },
  ]);
  await service.connect("http://192.168.10.126");
  expect(service.getSnapshot()).toMatchObject({
    state: "connected",
    medianAdc: 2903,
    moisturePercent: null,
  });
  await vi.advanceTimersByTimeAsync(SENSOR_WIFI.pollMs);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[0]?.[0]).toBe("http://192.168.10.126/sensor");
  service.disconnect();
  await vi.advanceTimersByTimeAsync(SENSOR_WIFI.pollMs * 2);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(service.getSnapshot()).toMatchObject({
    state: "disconnected",
    medianAdc: null,
  });
});
it("clears readings after connection loss and reconnects", async () => {
  const { service, fetcher } = setup();
  await service.reconnect();
  fetcher.mockRejectedValueOnce(new Error("Network request failed"));
  await vi.advanceTimersByTimeAsync(SENSOR_WIFI.pollMs);
  expect(service.getSnapshot()).toMatchObject({
    state: "connection_lost",
    medianAdc: null,
    updatedAt: null,
  });
  await service.reconnect();
  expect(service.getSnapshot().state).toBe("connected");
});
it("times out requests and reports a missing sensor", async () => {
  const { service, fetcher } = setup();
  fetcher.mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new Error("Sensor request timed out")),
          { once: true },
        );
      }),
  );
  const pending = service.scan();
  await vi.advanceTimersByTimeAsync(SENSOR_WIFI.timeoutMs);
  await pending;
  expect(service.getSnapshot().state).toBe("not_found");
  expect(service.getSnapshot().error).toContain("timed out");
});
it("ignores late responses after disconnect", async () => {
  const { service, fetcher } = setup();
  let resolve!: (response: Response) => void;
  fetcher.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = service.reconnect();
  service.disconnect();
  resolve(new Response(JSON.stringify(payload)));
  await pending;
  expect(service.getSnapshot()).toMatchObject({
    state: "disconnected",
    medianAdc: null,
  });
});
it("rejects HTTP failures without displaying an old PASS", async () => {
  const { service, fetcher } = setup();
  await service.reconnect();
  fetcher.mockResolvedValueOnce(new Response("{}", { status: 503 }));
  await vi.advanceTimersByTimeAsync(SENSOR_WIFI.pollMs);
  expect(service.getSnapshot()).toMatchObject({
    state: "connection_lost",
    provisionalStatus: null,
  });
});
it("requires a configured base URL", async () => {
  const service = new WifiSensorService("");
  services.push(service);
  await service.scan();
  expect(service.getSnapshot().error).toContain("EXPO_PUBLIC_SENSOR_WIFI_URL");
});

it.each([
  new TypeError("fetch failed"),
  new Error("Fetch request canceled exception"),
  new DOMException("The operation was aborted", "AbortError"),
])(
  "replaces native fetch errors with actionable connection-loss guidance",
  async (error) => {
    const { service, fetcher } = setup();
    await service.reconnect();
    fetcher.mockRejectedValueOnce(error);
    await vi.advanceTimersByTimeAsync(SENSOR_WIFI.pollMs);
    expect(service.getSnapshot()).toMatchObject({
      state: "connection_lost",
      medianAdc: null,
      provisionalStatus: null,
      updatedAt: null,
      error:
        "Sensor connection lost. Check that the ESP32 is powered on and connected to the same Wi-Fi, then tap Reconnect.",
    });
    await service.reconnect();
    expect(service.getSnapshot()).toMatchObject({
      state: "connected",
      error: null,
    });
  },
);

it("shows connection lost after a powered-off sensor times out", async () => {
  const { service, fetcher } = setup();
  await service.reconnect();
  fetcher.mockImplementationOnce(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new Error("Fetch request canceled exception")),
          { once: true },
        );
      }),
  );
  await vi.advanceTimersByTimeAsync(SENSOR_WIFI.pollMs + SENSOR_WIFI.timeoutMs);
  expect(service.getSnapshot().error).toContain("Sensor connection lost.");
  expect(service.getSnapshot().medianAdc).toBeNull();
});
