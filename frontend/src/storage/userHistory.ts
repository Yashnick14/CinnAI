import { APP } from "../config/app";
import {
  createHistoryRepository,
  type KeyValueStore,
  type ImageStore,
  type HistoryRepository,
} from "./historyRepository";

/** Select a separate local history repository for each authenticated user. */
export function createUserHistory(
  storage: KeyValueStore,
  images: ImageStore,
  currentUid: () => string | null,
): HistoryRepository {
  const repositories = new Map<string, HistoryRepository>();

  /** Resolve the active user's history repository, rejecting signed-out access. */
  function current() {
    const uid = currentUid();
    if (!uid) throw new Error("Sign in to access your saved assessments.");
    let repo = repositories.get(uid);
    if (!repo) {
      repo = createHistoryRepository(
        storage,
        {
          ...images,

          /** Write the updated record collection to its account-specific storage key. */
          persist: (uri, id) => images.persist(uri, encodeURIComponent(uid) + "-" + id),
        },
        APP.historyKey + ":user:" + encodeURIComponent(uid),
      );
      repositories.set(uid, repo);
    }
    return repo;
  }
  // Capture the owner synchronously before any queued/async work begins.
  return {
    /** Load grading records from this repository. */
    list: () => current().list(),

    /** Look up a grading record by its identifier. */
    get: (id) => current().get(id),

    /** Persist the grading assessment through the configured storage flow. */
    save: (record) => current().save(record),

    /** Remove the selected record through the repository's deletion flow. */
    remove: (id) => current().remove(id),
  };
}
