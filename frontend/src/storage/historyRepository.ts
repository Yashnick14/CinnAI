import { z } from "zod";
import { APP } from "../config/app";
import { GradingResultSchema, type GradingResult } from "../types/grading";

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface ImageStore {
  persist(uri: string, id: string): Promise<string>;
  resolve?(uri: string): string;
}
export interface HistoryRepository {
  list(): Promise<GradingResult[]>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<GradingResult | undefined>;
  save(result: GradingResult): Promise<GradingResult>;
}
export function createHistoryRepository(
  storage: KeyValueStore,
  images: ImageStore,
  storageKey: string = APP.historyKey,
): HistoryRepository {
  let queue: Promise<unknown> = Promise.resolve();
  const list = async () => {
    const raw = await storage.getItem(storageKey);
    if (!raw) return [];
    try {
      return z
        .array(GradingResultSchema)
        .parse(JSON.parse(raw))
        .map((record) => ({
          ...record,
          imageUri:
            record.imageUri && images.resolve
              ? images.resolve(record.imageUri)
              : record.imageUri,
        }))
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    } catch {
      throw new Error(
        "Saved history could not be read. Existing records have been preserved.",
      );
    }
  };
  return {
    list,
    get: async (id) => (await list()).find((r) => r.id === id),
    remove(id) {
      const operation = queue.then(async () => {
        const records = await list();
        await storage.setItem(
          storageKey,
          JSON.stringify(records.filter((r) => r.id !== id)),
        );
      });
      queue = operation.catch(() => {});
      return operation;
    },
    save(result) {
      const operation = queue.then(async () => {
        const validated = GradingResultSchema.parse(result);
        const records = await list();
        const existing = records.find((r) => r.id === validated.id);
        if (existing) return existing;
        const imageUri = validated.imageUri
          ? await images.persist(validated.imageUri, validated.id)
          : undefined;
        const saved = { ...validated, imageUri };
        await storage.setItem(storageKey, JSON.stringify([saved, ...records]));
        return saved;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
