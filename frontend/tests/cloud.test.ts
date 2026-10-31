import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/services/cloudApi", () => ({ cloudRequest: vi.fn(), cloudUid: () => "alice" }));
import { CloudSensorService, parseCloudReading } from "../src/services/cloudSensor";
import { createCloudHistory } from "../src/storage/cloudHistory";
import { createMockResult } from "../src/services/mockGrading";
const received = "2026-10-29T08:00:00.000Z";
const reading = (adc = 2910, age = 0) => ({ state: "available", reading: { id: "event", device_id: "probe", adc,
  percentage: null, status: adc >= 2842 ? "PASS_PROVISIONAL" : "FAIL_PROVISIONAL",
  received_at: received, server_time: received, age_ms: age, stale: age > 30000 } });
afterEach(() => vi.useRealTimers());
it("preserves server time across repeated polling; never refreshes an old sample", () => {
  expect(parseCloudReading(reading(), "probe").updatedAt).toBe(received);
  expect(parseCloudReading(reading(2910, 31000), "probe")).toMatchObject({ updatedAt: received, stale: true });
});
it.each([[2842,"PASS"],[2841,"FAIL"]])("uses unchanged provisional ADC rule %s", (adc,status) => {
  expect(parseCloudReading(reading(Number(adc)), "probe").provisionalStatus).toBe(status);
});
it("rejects missing, revoked, fractional ADC and mismatched device readings", () => {
  expect(() => parseCloudReading({state:"missing",reading:null},"probe")).toThrow();
  expect(() => parseCloudReading({...reading(),state:"revoked"},"probe")).toThrow();
  expect(() => parseCloudReading(reading(2.4),"probe")).toThrow();
  expect(() => parseCloudReading(reading(),"other")).toThrow();
});
it("recovers from network failure on polling and clears data on disconnect", async () => {
  vi.useFakeTimers(); const request=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(reading());
  const sensor=new CloudSensorService(request,()=>"alice");
  await sensor.connect("probe"); expect(sensor.getSnapshot().state).toBe("connection_lost");
  await vi.advanceTimersByTimeAsync(2000); expect(sensor.getSnapshot().medianAdc).toBe(2910);
  sensor.disconnect(); expect(sensor.getSnapshot().medianAdc).toBeNull();
});
it("ignores a response after account switch", async () => {
  let uid="alice"; let resolve!: (v:unknown)=>void;
  const sensor=new CloudSensorService(vi.fn(()=>new Promise(r=>{resolve=r;})),()=>uid);
  const p=sensor.connect("probe"); uid="bob"; resolve(reading()); await p;
  expect(sensor.getSnapshot().medianAdc).toBeNull(); sensor.dispose();
});
const record=()=>createMockResult({imageUri:"file:///private.jpg",moisturePercent:null,scenario:"accepted"},
  "7d99e15a-8743-4e3d-903c-d3c6952191bb",received);
function historySetup(request: ReturnType<typeof vi.fn>) {
  const r=record(); const local={list:vi.fn(async()=>[r]),get:vi.fn(async()=>r),
    save:vi.fn(async()=>r),remove:vi.fn(async()=>{})};
  return {local, repo:createCloudHistory(local,request,()=>"alice")};
}
it("retains local save if cloud is offline and reports pending sync",async()=>{
  const {repo,local}=historySetup(vi.fn().mockRejectedValue(new Error("offline")));
  expect(await repo.save(record())).toEqual(record()); expect(local.save).toHaveBeenCalled();
  expect(repo.getSyncStatus()).toContain("locally only");
});
it("explicit migration uploads metadata without image URI and retains local records",async()=>{
  const request=vi.fn().mockResolvedValueOnce([]).mockResolvedValue({});
  const {repo,local}=historySetup(request); await repo.syncLocal();
  const body=JSON.parse(request.mock.calls[1]![1].body);
  expect(body.record.imageUri).toBeUndefined(); expect(local.remove).not.toHaveBeenCalled();
});
it("does not resurrect cloud-deleted records during migration",async()=>{
  const request=vi.fn().mockResolvedValue([{id:record().id,_deleted:true}]);
  const {repo}=historySetup(request); expect(await repo.list()).toEqual([]);
  await repo.syncLocal(); expect(request.mock.calls.every(c=>!c[1]?.method)).toBe(true);
});
it("failed cloud deletion does not discard local history",async()=>{
  const {repo,local}=historySetup(vi.fn().mockRejectedValue(new Error("offline")));
  await expect(repo.remove(record().id)).rejects.toThrow(); expect(local.remove).not.toHaveBeenCalled();
});
