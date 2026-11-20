import { z } from "zod";
import { GradingResultSchema, type GradingResult } from "../types/grading";
import type { HistoryRepository } from "./historyRepository";
import { cloudRequest, cloudUid } from "../services/cloudApi";

/** Use the database as the source of truth; local storage only supplies device photos. */
export function createCloudHistory(
  local: HistoryRepository,
  request = cloudRequest,
  uid = cloudUid,
): HistoryRepository {
  const owner = () => {
    const id = uid();
    if (!id) throw new Error("Sign in to access history.");
    return id;
  };
  const check = (id: string) => {
    if (uid() !== id) throw new Error("Account changed. Please retry.");
  };
  const RecordSchema = z.union([
    z.object({ id: z.string().uuid(), _deleted: z.literal(true) }),
    GradingResultSchema,
  ]);

  /** Fetch only records belonging to the authenticated account, including all pages. */
  async function remote(id: string) {
    const records: z.infer<typeof RecordSchema>[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = z
        .array(RecordSchema)
        .parse(await request(`/history?offset=${offset}&limit=100`, {}, id));
      check(id);
      records.push(...page);
      if (page.length < 100) return records;
    }
  }

  // Share only requests currently in progress; completed records are never used as an offline fallback.
  let pending: { owner: string; promise: Promise<GradingResult[]> } | undefined;

  async function load(id: string) {
    // Load device photos while the database request is running, rather than afterwards.
    const [records, photos] = await Promise.all([
      remote(id),
      local.list().catch(() => []),
    ]);
    check(id);
    const images = new Map(photos.map((r) => [r.id, r.imageUri]));
    return records
      .filter((r): r is GradingResult => !("_deleted" in r))
      .map((r) => ({
        ...r,
        imageUri: images.get(r.id),
      }))
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }

  const repository: HistoryRepository = {
    async list() {
      const id = owner();
      if (pending?.owner === id) return pending.promise;
      const entry = { owner: id, promise: load(id) };
      pending = entry;
      try {
        return await entry.promise;
      } finally {
        if (pending === entry) pending = undefined;
      }
    },
    async get(recordId) {
      return (await repository.list()).find((r) => r.id === recordId);
    },
    async save(record) {
      const id = owner();
      const validated = GradingResultSchema.parse(record);
      const { imageUri, ...metadata } = validated;
      const response = RecordSchema.parse(
        await request(
          "/history",
          {
            method: "POST",
            body: JSON.stringify({ record: metadata }),
          },
          id,
        ),
      );
      check(id);
      pending = undefined;
      if (response.id !== validated.id)
        throw new Error("Unexpected saved assessment. Please retry.");
      if ("_deleted" in response)
        throw new Error("This assessment was deleted and cannot be saved again.");
      // Preserve the existing on-device image only after the database acknowledges saving.
      const saved = { ...response, imageUri };
      const cached = await local.save(saved).catch(() => saved);
      check(id);
      return { ...response, imageUri: cached.imageUri };
    },
    async remove(recordId) {
      const id = owner();
      await request(
        `/history/${encodeURIComponent(recordId)}/delete`,
        { method: "POST" },
        id,
      );
      check(id);
      pending = undefined;
      await local.remove(recordId).catch(() => {});
      check(id);
    },
  };
  return repository;
}
