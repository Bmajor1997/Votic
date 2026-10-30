import {
  clear_old_temporary_files,
  read_scan_photo_usage,
  read_temporary_usage,
  TEMP_RETENTION_MS,
} from "./storageUsageFiles";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  os: "android",
  files: new Map<string, { size: number; modified: number | null; created?: number | null }>(),
  removed: [] as string[],
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
}));
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_: string, uid: string) => `hash-${uid}`,
}));
vi.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return state.files.has(this.uri);
    }
    get size() {
      return state.files.get(this.uri)!.size;
    }
    get modificationTime() {
      return state.files.get(this.uri)!.modified;
    }
    get creationTime() {
      const entry = state.files.get(this.uri)!;
      return entry.created === undefined ? entry.modified : entry.created;
    }
    delete() {
      state.removed.push(this.uri);
      state.files.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    get exists() {
      return [...state.files.keys()].some((key) => key.startsWith(this.uri + "/"));
    }
    list() {
      const paths = [...state.files.keys()].filter((p) => p.startsWith(this.uri + "/"));
      const children = new Map<string, File | Directory>();
      for (const path of paths) {
        const relative = path.slice(this.uri.length + 1);
        const segment = relative.split("/")[0];
        children.set(segment, relative.includes("/") ? new Directory(this.uri, segment) : new File(path));
      }
      return [...children.values()];
    }
  }
  return {
    File,
    Directory,
    Paths: { cache: { uri: "file:///cache" }, document: { uri: "file:///documents" } },
  };
});

const now = 10 * TEMP_RETENTION_MS;
beforeEach(() => {
  state.files.clear();
  state.removed = [];
  state.os = "android";
});
describe("temporary file cleanup", () => {
  it("removes only old files in known cache folders, preserving recent files, scan drafts, originals and unknown cache", async () => {
    for (const [path, age] of [
      ["file:///cache/DocumentPicker/old.pdf", 2],
      ["file:///cache/Camera/nested/old.jpg", 2],
      ["file:///cache/LibraryBackups/old.json", 2],
      ["file:///cache/Camera/recent.jpg", 0.5],
      ["file:///cache/Camera/unknown-date.jpg", null],
      ["file:///cache/Other/keep", 2],
      ["file:///documents/ScanDrafts/hash-a/page.jpg", 2],
      ["file:///documents/ScanDrafts/hash-b/private.jpg", 2],
      ["file:///provider/original.pdf", 2],
    ] as [string, number | null][])
      state.files.set(path, { size: 100, modified: age === null ? null : now - age * TEMP_RETENTION_MS });
    expect(read_temporary_usage(now)).toEqual({ bytes: 500, clearableBytes: 300 });
    expect(await read_scan_photo_usage("a")).toBe(100);
    clear_old_temporary_files(now);
    expect(state.removed).toHaveLength(3);
    expect(state.files.has("file:///cache/Camera/recent.jpg")).toBe(true);
    expect(state.files.has("file:///cache/Camera/unknown-date.jpg")).toBe(true);
    expect(state.files.has("file:///documents/ScanDrafts/hash-a/page.jpg")).toBe(true);
    expect(state.files.has("file:///provider/original.pdf")).toBe(true);
    expect(state.files.has("file:///cache/Other/keep")).toBe(true);
  });
  it("keeps freshly copied files even if the original modification date was old", () => {
    const path = "file:///cache/DocumentPicker/fresh-copy.pdf";
    state.files.set(path, { size: 20, modified: 1, created: now });
    expect(read_temporary_usage(now)).toEqual({ bytes: 20, clearableBytes: 0 });
    clear_old_temporary_files(now);
    expect(state.files.has(path)).toBe(true);
    state.files.set(path, { size: 20, modified: 1, created: null });
    clear_old_temporary_files(now);
    expect(state.files.has(path)).toBe(true);
  });
  it("does not expose native measurements or cleanup on web", async () => {
    state.os = "web";
    state.files.set("file:///cache/DocumentPicker/old.pdf", { size: 10, modified: 1 });
    expect(read_temporary_usage(now)).toBeNull();
    expect(await read_scan_photo_usage("a")).toBeNull();
    clear_old_temporary_files(now);
    expect(state.removed).toEqual([]);
  });
});
