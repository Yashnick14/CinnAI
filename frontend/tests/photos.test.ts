import { beforeEach, describe, expect, it, vi } from "vitest";

const files = new Map<string, number>();
vi.mock("expo-crypto", () => ({
  randomUUID: () => "12345678-1234-4234-8234-123456789abc",
}));
vi.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}/${name}`;
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(parent: string | { uri: string }, name?: string) {
      this.uri = typeof parent === "string" ? parent : `${parent.uri}/${name}`;
    }
    get exists() {
      return files.has(this.uri);
    }
    get size() {
      return files.get(this.uri) ?? 0;
    }
    copy(target: File) {
      const size = files.get(this.uri);
      if (!size) throw new Error("missing");
      files.set(target.uri, size);
    }
  }
  return {
    Directory,
    File,
    Paths: { document: { uri: "file://current/Documents" } },
  };
});

describe("captured photo storage", () => {
  beforeEach(() => files.clear());
  it("copies a temporary camera file into durable app storage", async () => {
    files.set("file://cache/photo.jpg", 2048);
    const { preservePhoto } = await import("../src/storage/photos");
    await expect(preservePhoto("file://cache/photo.jpg")).resolves.toBe(
      "file://current/Documents/grading-images/12345678-1234-4234-8234-123456789abc.jpg",
    );
  });
  it("rejects a missing or empty capture", async () => {
    const { validatePhoto } = await import("../src/storage/photos");
    await expect(validatePhoto("file://cache/missing.jpg")).rejects.toThrow(
      "unavailable or empty",
    );
  });
  it("rebases a saved image after the iOS app container path changes", async () => {
    const { resolvePhotoUri } = await import("../src/storage/photos");
    expect(
      resolvePhotoUri("file://old/Documents/grading-images/sample-1.jpg"),
    ).toBe("file://current/Documents/grading-images/sample-1.jpg");
  });
});
