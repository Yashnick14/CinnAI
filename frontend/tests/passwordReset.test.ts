import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), auth: { name: "cinnai" } }));
vi.mock("firebase/auth", () => ({ sendPasswordResetEmail: mocks.send }));
vi.mock("../src/services/firebaseAuth", () => ({
  firebaseAuth: () => mocks.auth,
}));
import { requestPasswordReset } from "../src/services/passwordReset";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("__DEV__", false);
});
it("sends to the exact trimmed entered email using the configured Firebase auth", async () => {
  mocks.send.mockResolvedValueOnce(undefined);
  await expect(requestPasswordReset("  person@example.com  ")).resolves.toBe(
    "person@example.com",
  );
  expect(mocks.send).toHaveBeenCalledWith(mocks.auth, "person@example.com");
});
it("rejects invalid addresses without calling Firebase", async () => {
  await expect(requestPasswordReset("bad")).rejects.toThrow("email");
  expect(mocks.send).not.toHaveBeenCalled();
});
it("propagates Firebase errors instead of reporting success", async () => {
  mocks.send.mockRejectedValueOnce({ code: "auth/network-request-failed" });
  await expect(requestPasswordReset("a@b.com")).rejects.toEqual({
    code: "auth/network-request-failed",
  });
});
it("waits for Firebase to acknowledge the request", async () => {
  let complete!: () => void;
  mocks.send.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  let done = false;
  const request = requestPasswordReset("a@b.com").then(() => {
    done = true;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  complete();
  await request;
  expect(done).toBe(true);
});
