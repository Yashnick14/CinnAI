import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateCredentials, authError } from "../src/services/authValidation";
const mock = vi.hoisted(() => ({
  getApps: vi.fn(),
  getApp: vi.fn(() => "existing"),
  initializeApp: vi.fn(() => "new"),
  getAuth: vi.fn((app) => ({ app })),
  signInWithPopup: vi.fn(),
  setCustomParameters: vi.fn(),
}));
vi.mock("firebase/app", () => mock);
vi.mock("firebase/auth", () => ({
  ...mock,
  GoogleAuthProvider: class {
    setCustomParameters = mock.setCustomParameters;
  },
}));
vi.mock("../src/config/firebase", () => ({
  firebaseConfigured: true,
  firebaseConfig: { projectId: "test" },
}));
import { firebaseAuth } from "../src/services/firebaseAuth";
import { signInGoogle } from "../src/services/googleAuth";
describe("account input and errors", () => {
  it("accepts registration", () =>
    expect(
      validateCredentials(
        " user@example.com ",
        "password123",
        true,
        "User",
        "password123",
      ),
    ).toBeNull());
  it("rejects invalid email", () =>
    expect(validateCredentials("wrong", "password")).toContain("email"));
  it("requires password", () =>
    expect(validateCredentials("a@b.com", "")).toContain("password"));
  it("requires name", () =>
    expect(
      validateCredentials("a@b.com", "password", true, "", "password"),
    ).toContain("name"));
  it("rejects short signup passwords", () =>
    expect(
      validateCredentials("a@b.com", "short", true, "User", "short"),
    ).toContain("8"));
  it("does not reject existing shorter login password", () =>
    expect(validateCredentials("a@b.com", "short")).toBeNull());
  it("checks confirmation", () =>
    expect(
      validateCredentials("a@b.com", "password", true, "User", "different"),
    ).toContain("match"));
  it("maps network failure", () =>
    expect(authError({ code: "auth/network-request-failed" })).toContain(
      "internet",
    ));
  it("does not disclose server exception text", () =>
    expect(authError(new Error("secret"))).not.toContain("secret"));
  it("handles Google cancellation", () =>
    expect(authError({ code: "auth/popup-closed-by-user" })).toContain(
      "cancelled",
    ));
});
describe("Firebase integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.getApps.mockReturnValue([]);
  });
  it("initializes configured app", () => {
    firebaseAuth();
    expect(mock.initializeApp).toHaveBeenCalledWith({ projectId: "test" });
  });
  it("reuses existing Firebase app", () => {
    mock.getApps.mockReturnValue([{}]);
    firebaseAuth();
    expect(mock.initializeApp).not.toHaveBeenCalled();
    expect(mock.getAuth).toHaveBeenCalledWith("existing");
  });
  it("uses Firebase Google popup with account selection", async () => {
    await signInGoogle();
    expect(mock.signInWithPopup).toHaveBeenCalledOnce();
    expect(mock.setCustomParameters).toHaveBeenCalledWith({
      prompt: "select_account",
    });
  });
  it("propagates Google failure to UI handler", async () => {
    mock.signInWithPopup.mockRejectedValueOnce({
      code: "auth/popup-closed-by-user",
    });
    await expect(signInGoogle()).rejects.toEqual({
      code: "auth/popup-closed-by-user",
    });
  });
});
