import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { account_storage_key } from "./accountStorage";
import { document_text_key, LIBRARY_KEY } from "../documents/documentStorage";
import { format_storage_bytes, read_account_storage_usage } from "./storageUsage";

const memory = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getAllKeys: vi.fn(async () => [...memory.keys()]),
    multiGet: vi.fn(async (keys: string[]) => keys.map((key) => [key, memory.get(key) ?? null])),
  },
}));
beforeEach(() => {
  memory.clear();
  vi.clearAllMocks();
});
describe("local storage measurement", () => {
  it("counts UTF-8 text chunks and notes without reading another account or changing stored data", async () => {
    const metadata = [
      { id: "one", title: "Résumé", textChunks: 2, savedPassages: [{ note: "🙂" }], deletedAt: 1 },
    ];
    const raw = JSON.stringify(metadata);
    memory.set(account_storage_key(LIBRARY_KEY, "a"), raw);
    memory.set(document_text_key("one", 0, "a"), "café");
    memory.set(document_text_key("one", 1, "a"), "🙂");
    memory.set(account_storage_key("draft", "a"), "draft");
    memory.set(account_storage_key(LIBRARY_KEY, "ab"), "private other account");
    memory.set("votic.mobile.documents.v1", "legacy private copy");
    const before = [...memory];
    const result = await read_account_storage_usage("a");
    expect(result.bytes).toBe(new TextEncoder().encode(raw).length + 5 + 4 + 5);
    expect(result.documents).toEqual([
      {
        id: "one",
        title: "Résumé",
        deleted: true,
        bytes: new TextEncoder().encode(JSON.stringify(metadata[0])).length + 9,
      },
    ]);
    expect([...memory]).toEqual(before);
    expect(vi.mocked(AsyncStorage.multiGet).mock.calls.flat(2)).not.toContain(
      account_storage_key(LIBRARY_KEY, "ab"),
    );
  });
  it("rejects missing chunks, malformed metadata, and failed reads instead of reporting an empty library", async () => {
    const key = account_storage_key(LIBRARY_KEY, "a");
    memory.set(key, JSON.stringify([{ id: "one", title: "Book", textChunks: 2 }]));
    memory.set(document_text_key("one", 0, "a"), "kept");
    await expect(read_account_storage_usage("a")).rejects.toThrow(/unavailable/);
    memory.set(key, "{}");
    await expect(read_account_storage_usage("a")).rejects.toThrow(/could not be read/);
    vi.mocked(AsyncStorage.multiGet).mockRejectedValueOnce(new Error("storage failed"));
    await expect(read_account_storage_usage("a")).rejects.toThrow("storage failed");
    expect(memory.get(document_text_key("one", 0, "a"))).toBe("kept");
  });
  it("handles an empty account and formats decimal units consistently with the import limits", async () => {
    await expect(read_account_storage_usage("a")).resolves.toEqual({ bytes: 0, documents: [] });
    await expect(read_account_storage_usage("")).rejects.toThrow(/Sign in/);
    expect([0, 999, 1000, 25_000_000, 1_000_000_000].map(format_storage_bytes)).toEqual([
      "0 B",
      "999 B",
      "1.0 KB",
      "25.0 MB",
      "1.0 GB",
    ]);
  });
});
