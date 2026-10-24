import { beforeEach, expect, it, jest } from "@jest/globals";
const mockFiles = new Map<string, ArrayBuffer>();
const mockDirectories = new Set<string>();
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(async (_algorithm: string, uid: string) => `owner-${uid}`),
}));
jest.mock("expo-file-system", () => {
  const uri = (parts: unknown[]) =>
    parts
      .map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri))
      .map((piece, at) => (at ? piece.replace(/^\/+|\/+$/g, "") : piece.replace(/\/+$/g, "")))
      .join("/");
  class FakeFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = uri(parts);
    }
    get name() {
      return this.uri.split("/").at(-1)!;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri)?.byteLength || 0;
    }
    copy(target: FakeFile) {
      mockFiles.set(target.uri, mockFiles.get(this.uri)!.slice(0));
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  return {
    Paths: { document: { uri: "file:///documents" } },
    File: FakeFile,
    Directory: class {
      uri: string;
      constructor(...parts: unknown[]) {
        this.uri = uri(parts);
      }
      get exists() {
        return mockDirectories.has(this.uri);
      }
      create() {
        mockDirectories.add(this.uri);
      }
      delete() {
        for (const key of mockFiles.keys()) if (key.startsWith(this.uri + "/")) mockFiles.delete(key);
        mockDirectories.delete(this.uri);
      }
      list() {
        return [...mockFiles.keys()]
          .filter((key) => key.startsWith(this.uri + "/"))
          .map((key) => new FakeFile(key));
      }
    },
  };
});
const native = jest.requireActual<typeof import("../../src/documents/scanDraftFiles")>(
  "../../src/documents/scanDraftFiles",
);
beforeEach(() => {
  mockFiles.clear();
  mockDirectories.clear();
});
it("copies camera images to durable account folders and erases only that owner's photos", async () => {
  mockFiles.set("file:///cache/photo.jpg", new ArrayBuffer(8));
  const a = await native.persist_scan_photo("a", "page-one.jpg", "file:///cache/photo.jpg");
  const b = await native.persist_scan_photo("b", "page-two.jpg", "file:///cache/photo.jpg");
  expect(a).toBe("file:///documents/ScanDrafts/owner-a/page-one.jpg");
  expect(mockFiles.has(a)).toBe(true);
  await native.delete_scan_photos("a");
  expect(mockFiles.has(a)).toBe(false);
  expect(mockFiles.has(b)).toBe(true);
  expect(mockFiles.has("file:///cache/photo.jpg")).toBe(true);
});
it("rejects oversized photos and unsafe restored filenames", async () => {
  mockFiles.set("file:///cache/large.jpg", new ArrayBuffer(12_000_001));
  await expect(native.persist_scan_photo("a", "page-one.jpg", "file:///cache/large.jpg")).rejects.toThrow(
    /too large/,
  );
  await expect(native.scan_page_uri("a", "../another-account.jpg")).rejects.toThrow("Invalid scan photo");
});
