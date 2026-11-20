import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/services/cloudApi", () => ({
  cloudRequest: vi.fn(),
  cloudUid: () => "alice",
}));
import { CloudSensorService, parseCloudReading } from "../src/services/cloudSensor";
import { createCloudHistory } from "../src/storage/cloudHistory";
import { createMockResult } from "../src/services/mockGrading";

const received = "2026-10-29T08:00:00.000Z";
const reading = (adc = 1800, age = 0) => ({
  state: "available",
  reading: {
    id: "event",
    device_id: "probe",
    adc,
    percentage: null,
    status:
      adc >= 2850 ? "UNTOUCHED" : adc >= 1711 ? "PASS_PROVISIONAL" : "FAIL_PROVISIONAL",
    received_at: received,
    server_time: received,
    age_ms: age,
    stale: age > 30000,
  },
});
afterEach(() => vi.useRealTimers());
it("preserves server time across repeated polling; never refreshes an old sample", () => {
  expect(parseCloudReading(reading(), "probe").updatedAt).toBe(received);
  expect(parseCloudReading(reading(1800, 31000), "probe")).toMatchObject({
    updatedAt: received,
    stale: true,
  });
});
it.each([
  [1711, "PASS"],
  [1710, "FAIL"],
])("uses unchanged provisional ADC rule %s", (adc, status) => {
  expect(parseCloudReading(reading(Number(adc)), "probe").provisionalStatus).toBe(
    status,
  );
});
it("rejects missing, revoked, fractional ADC and mismatched device readings", () => {
  expect(() =>
    parseCloudReading({ state: "missing", reading: null }, "probe"),
  ).toThrow();
  expect(() =>
    parseCloudReading({ ...reading(), state: "revoked" }, "probe"),
  ).toThrow();
  expect(() => parseCloudReading(reading(2.4), "probe")).toThrow();
  expect(() => parseCloudReading(reading(), "other")).toThrow();
});
it("recovers from network failure on polling and clears data on disconnect", async () => {
  vi.useFakeTimers();
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(reading());
  const sensor = new CloudSensorService(request, () => "alice");
  await sensor.connect("probe");
  expect(sensor.getSnapshot().state).toBe("connection_lost");
  await vi.advanceTimersByTimeAsync(2000);
  expect(sensor.getSnapshot().medianAdc).toBe(1800);
  sensor.disconnect();
  expect(sensor.getSnapshot().medianAdc).toBeNull();
});
it("ignores a response after account switch", async () => {
  let uid = "alice";
  let resolve!: (v: unknown) => void;
  const sensor = new CloudSensorService(
    vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
    () => uid,
  );
  const p = sensor.connect("probe");
  uid = "bob";
  resolve(reading());
  await p;
  expect(sensor.getSnapshot().medianAdc).toBeNull();
  sensor.dispose();
});
const record = () =>
  createMockResult(
    { imageUri: "file:///private.jpg", moisturePercent: null, scenario: "accepted" },
    "7d99e15a-8743-4e3d-903c-d3c6952191bb",
    received,
  );
function historySetup(request: ReturnType<typeof vi.fn>) {
  const r = record();
  const local = {
    list: vi.fn(async () => [r]),
    get: vi.fn(async () => r),
    save: vi.fn(async () => r),
    remove: vi.fn(async () => {}),
  };
  return { local, repo: createCloudHistory(local, request, () => "alice") };
}
it("rejects failed database saves without silently saving locally", async () => {
  const { repo, local } = historySetup(vi.fn().mockRejectedValue(new Error("offline")));
  await expect(repo.save(record())).rejects.toThrow("offline");
  expect(local.save).not.toHaveBeenCalled();
});
it("saves owner-scoped metadata directly and preserves the device photo afterward", async () => {
  const request = vi.fn().mockResolvedValue({ ...record(), imageUri: undefined });
  const { repo, local } = historySetup(request);
  expect((await repo.save(record())).id).toBe(record().id);
  expect(request.mock.calls[0]![2]).toBe("alice");
  expect(JSON.parse(request.mock.calls[0]![1].body).record.imageUri).toBeUndefined();
  expect(local.save).toHaveBeenCalled();
});
it("shows only database records and excludes deletion markers", async () => {
  const { repo } = historySetup(vi.fn().mockResolvedValue([]));
  expect(await repo.list()).toEqual([]);
  const deleted = historySetup(
    vi.fn().mockResolvedValue([{ id: record().id, _deleted: true }]),
  );
  expect(await deleted.repo.list()).toEqual([]);
});
it("does not fall back to local records when the database is unavailable", async () => {
  const { repo } = historySetup(vi.fn().mockRejectedValue(new Error("offline")));
  await expect(repo.list()).rejects.toThrow("offline");
});
it("uses database metadata rather than cached values and preserves only its photo", async () => {
  const request = vi
    .fn()
    .mockResolvedValue([{ ...record(), diameterMm: 17.5, imageUri: undefined }]);
  const { repo } = historySetup(request);
  const results = await repo.list();
  expect(results[0]!.diameterMm).toBe(17.5);
  expect(results[0]!.imageUri).toBe(record().imageUri);
});
it("rejects an account change while fetching records", async () => {
  let user = "alice";
  const { local } = historySetup(vi.fn());
  const request = vi.fn().mockImplementation(async () => {
    user = "bob";
    return [record()];
  });
  const repo = createCloudHistory(local, request, () => user);
  await expect(repo.list()).rejects.toThrow("Account changed");
  // Photo loading may run concurrently, but account protection rejects the result.
  expect(local.list).toHaveBeenCalledTimes(1);
});
it("requires sign-in before any history request", async () => {
  const { local } = historySetup(vi.fn());
  const request = vi.fn();
  const repo = createCloudHistory(local, request, () => null);
  await expect(repo.list()).rejects.toThrow("Sign in");
  await expect(repo.save(record())).rejects.toThrow("Sign in");
  await expect(repo.remove(record().id)).rejects.toThrow("Sign in");
  expect(request).not.toHaveBeenCalled();
});
it("failed database deletion does not discard the photo cache", async () => {
  const { repo, local } = historySetup(vi.fn().mockRejectedValue(new Error("offline")));
  await expect(repo.remove(record().id)).rejects.toThrow();
  expect(local.remove).not.toHaveBeenCalled();
});
it("a deleted assessment cannot be reported as saved", async () => {
  const { repo, local } = historySetup(
    vi.fn().mockResolvedValue({ id: record().id, _deleted: true }),
  );
  await expect(repo.save(record())).rejects.toThrow("deleted");
  expect(local.save).not.toHaveBeenCalled();
});

it.each([2850, 2970, 4095])(
  "keeps untouched ADC %d live without PASS or FAIL",
  (adc) => {
    expect(parseCloudReading(reading(adc), "probe")).toMatchObject({
      medianAdc: adc,
      provisionalStatus: null,
    });
  },
);

it("uses one-second live polling and returns to normal polling without overlaps", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue(reading());
  const sensor = new CloudSensorService(request, () => "alice");
  sensor.setLiveViewActive(true);
  await sensor.connect("probe");
  await vi.advanceTimersByTimeAsync(999);
  expect(request).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(request).toHaveBeenCalledTimes(2);
  sensor.setLiveViewActive(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(request).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(1999);
  expect(request).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(1);
  expect(request).toHaveBeenCalledTimes(4);
  sensor.dispose();
  await vi.advanceTimersByTimeAsync(5000);
  expect(request).toHaveBeenCalledTimes(4);
});

it("waits for the in-flight response even when live polling is enabled", async () => {
  vi.useFakeTimers();
  let resolve!: (value: unknown) => void;
  const request = vi.fn().mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const sensor = new CloudSensorService(request, () => "alice");
  const pending = sensor.connect("probe");
  sensor.setLiveViewActive(true);
  await vi.advanceTimersByTimeAsync(10000);
  expect(request).toHaveBeenCalledTimes(1);
  resolve(reading());
  await pending;
  await vi.advanceTimersByTimeAsync(999);
  expect(request).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(request).toHaveBeenCalledTimes(2);
  sensor.disconnect();
  resolve(reading());
  await vi.advanceTimersByTimeAsync(5000);
  expect(sensor.getSnapshot().state).toBe("disconnected");
  expect(request).toHaveBeenCalledTimes(2);
});

it("shares overlapping database loads and starts photos without waiting for the network", async () => {
  let finish!: (value: unknown) => void;
  const request = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { local, repo } = historySetup(request);
  const first = repo.list();
  const second = repo.list();
  expect(request).toHaveBeenCalledTimes(1);
  expect(local.list).toHaveBeenCalledTimes(1);
  finish([record()]);
  expect(await first).toEqual(await second);
  const third = repo.list();
  expect(request).toHaveBeenCalledTimes(2);
  finish([]);
  expect(await third).toEqual([]);
});
