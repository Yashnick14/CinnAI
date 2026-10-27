import { APP } from "../config/app";
import {
  createHistoryRepository,
  type KeyValueStore,
  type ImageStore,
  type HistoryRepository,
} from "./historyRepository";
export function createUserHistory(
  storage: KeyValueStore,
  images: ImageStore,
  currentUid: () => string | null,
): HistoryRepository {
  const repositories = new Map<string, HistoryRepository>();
  function current() {
    const uid = currentUid();
    if (!uid) throw new Error("Sign in to access your saved assessments.");
    let repo = repositories.get(uid);
    if (!repo) {
      repo = createHistoryRepository(
        storage,
        {
          ...images,
          persist: (uri, id) =>
            images.persist(uri, encodeURIComponent(uid) + "-" + id),
        },
        APP.historyKey + ":user:" + encodeURIComponent(uid),
      );
      repositories.set(uid, repo);
    }
    return repo;
  }
  // Capture the owner synchronously before any queued/async work begins.
  return {
    list: () => current().list(),
    get: (id) => current().get(id),
    save: (record) => current().save(record),
    remove: (id) => current().remove(id),
  };
}
