import { expect, it } from "vitest";
import { createUserHistory } from "../src/storage/userHistory";
import { createMockResult } from "../src/services/mockGrading";
import { accountSummary } from "../src/utils/accountSummary";
import { APP } from "../src/config/app";
const record = () =>
  createMockResult(
    {
      imageUri: "file:///sample.jpg",
      moisturePercent: null,
      scenario: "accepted",
    },
    "7d99e15a-8743-4e3d-903c-d3c6952191bb",
    "2026-10-25T10:00:00.000Z",
  );
function setup() {
  let uid: string | null = "a";
  const data = new Map<string, string>();
  const repo = createUserHistory(
    {
      getItem: async (key) => data.get(key) ?? null,
      setItem: async (key, value) => {
        data.set(key, value);
      },
    },
    { persist: async (uri, id) => id },
    () => uid,
  );
  return {
    repo,
    data,
    user: (value: string | null) => {
      uid = value;
    },
  };
}
it("isolates list/get/delete by signed-in user", async () => {
  const { repo, user } = setup();
  await repo.save(record());
  user("b");
  expect(await repo.list()).toEqual([]);
  expect(await repo.get(record().id)).toBeUndefined();
  await repo.remove(record().id);
  user("a");
  expect(await repo.list()).toHaveLength(1);
});
it("preserves unassigned legacy data without exposing it", async () => {
  const { repo, data } = setup();
  const legacy = JSON.stringify([record()]);
  data.set(APP.historyKey, legacy);
  expect(await repo.list()).toEqual([]);
  await repo.save(record());
  expect(data.get(APP.historyKey)).toBe(legacy);
});
it("captures owner before asynchronous saving even if user changes", async () => {
  const { repo, user } = setup();
  const pending = repo.save(record());
  user("b");
  await pending;
  expect(await repo.list()).toEqual([]);
  user("a");
  expect(await repo.list()).toHaveLength(1);
});
it("requires sign-in for every operation", () => {
  const { repo, user } = setup();
  user(null);
  expect(() => repo.list()).toThrow("Sign in");
  expect(() => repo.save(record())).toThrow("Sign in");
  expect(() => repo.remove(record().id)).toThrow("Sign in");
  expect(() => repo.get(record().id)).toThrow("Sign in");
});
it("same record id in two accounts has distinct photo paths", async () => {
  const { repo, user } = setup();
  const a = await repo.save(record());
  user("b");
  const b = await repo.save(record());
  expect(a.imageUri).not.toBe(b.imageUri);
  expect(await repo.list()).toHaveLength(1);
});
it("dashboard handles empty history and excludes ungraded quills", () => {
  expect(accountSummary([]).assessments).toBe(0);
  expect(accountSummary([]).common).toBeNull();
  expect(
    accountSummary([{ ...record(), finalGrade: null, detectedQuillCount: 5 }])
      .gradedQuills,
  ).toBe(0);
});
it("dashboard counts grades and completed reviews", () => {
  const r = record();
  const stats = accountSummary([
    { ...r, finalGrade: "M4", detectedQuillCount: 2 },
    {
      ...r,
      finalGrade: "M4",
      detectedQuillCount: 1,
      manualReview: {
        selectedGrade: "M4",
        reviewer: "User",
        reason: "Review",
        notes: "",
        reviewedAt: r.timestamp,
        originalStatus: "VALID",
        originalGrade: "M5",
        originalDiameterGrade: "M5",
        originalMessage: "",
      },
    },
  ]);
  expect(stats.gradedQuills).toBe(3);
  expect(stats.manualReviews).toBe(1);
  expect(stats.common).toBe("M4");
  expect(stats.grades).toEqual([["M4", 2]]);
});
