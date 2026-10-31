import { z } from "zod";
import { GradingResultSchema } from "../types/grading";
import type { HistoryRepository } from "./historyRepository";
import { cloudRequest, cloudUid } from "../services/cloudApi";
export function createCloudHistory(local: HistoryRepository, request = cloudRequest, uid = cloudUid) {
  let message = "Cloud sync ready. Existing local records remain on this device.";
  const listeners = new Set<() => void>();
  const notify = (text: string) => { message = text; listeners.forEach(fn => fn()); };
  const owner = () => { const id = uid(); if (!id) throw new Error("Sign in to access history."); return id; };
  const check = (id: string) => { if (uid() !== id) throw new Error("Account changed. Please retry."); };
  const RecordSchema = z.union([z.object({ id: z.string().uuid(), _deleted: z.literal(true) }), GradingResultSchema]);
  async function remote(id: string) {
    const records: z.infer<typeof RecordSchema>[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = z.array(RecordSchema).parse(await request(`/history?offset=${offset}&limit=100`, {}, id));
      check(id); records.push(...page); if (page.length < 100) return records;
    }
  }
  const repository: HistoryRepository = {
    async list() {
      const id = owner(); const localRecords = await local.list(); check(id);
      try {
        const cloud = await remote(id); check(id);
        const merged = new Map(localRecords.map(r => [r.id, r]));
        for (const r of cloud) {
          if ("_deleted" in r) merged.delete(r.id);
          else merged.set(r.id, { ...r, imageUri: merged.get(r.id)?.imageUri });
        }
        notify("Cloud history loaded. Photos remain on the device that captured them.");
        return [...merged.values()].sort((a,b) => Date.parse(b.timestamp)-Date.parse(a.timestamp));
      } catch { check(id); notify("Cloud unavailable. Showing local records; use Sync when online."); return localRecords; }
    },
    async get(id) { return (await repository.list()).find(r => r.id === id); },
    async save(record) {
      const id = owner(); const saved = await local.save(record); check(id);
      try {
        const { imageUri: _localPhoto, ...metadata } = saved;
        await request("/history", { method: "POST", body: JSON.stringify({ record: metadata }) }, id);
        check(id); notify("Saved locally and to cloud history.");
      } catch { check(id); notify("Saved locally only. Open History and Sync when online."); }
      return saved;
    },
    async remove(recordId) {
      const id = owner();
      await request(`/history/${encodeURIComponent(recordId)}/delete`, { method: "POST" }, id);
      check(id); await local.remove(recordId); notify("Record deleted from cloud and this device.");
    },
  };
  return { ...repository,
    getSyncStatus: () => message,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async syncLocal() {
      const id = owner(); const records = await local.list(); check(id);
      const cloud = await remote(id); const existing = new Set(cloud.map(r => r.id));
      for (const r of records) {
        if (existing.has(r.id)) continue;
        check(id); const { imageUri: _photo, ...metadata } = r;
        await request("/history", { method: "POST", body: JSON.stringify({ record: metadata }) }, id);
      }
      check(id); notify("Local assessment metadata synchronized. Local photos were preserved.");
    },
  };
}
