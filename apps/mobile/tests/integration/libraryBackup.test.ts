import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, it, expect, jest } from "@jest/globals";
import { create_document_store } from "../../src/documents/documentStorage";
import {
  create_library_backup,
  restore_library_backup,
  resume_library_restores,
  library_restore_pending,
} from "../../src/storage/libraryBackup";
import { parse_library_backup } from "../../src/storage/libraryBackupModel";
import { account_storage_key } from "../../src/storage/accountStorage";
import { mark_account_deletion } from "../../src/storage/accountDeletion";

const document = {
  id: "doc-a",
  title: "Private document",
  sourceName: "source.txt",
  plainText: "Text ".repeat(110000),
  progress: 0.4,
  sentenceIndex: 2,
  wordIndex: 1,
  playbackRate: 1.5,
  importedAt: 1,
  updatedAt: 2,
  savedPassages: [
    {
      id: "note-1",
      sentenceIndex: 1,
      text: "Text",
      note: "Keep this note",
      createdAt: 1,
      updatedAt: 2,
      tags: ["work"],
    },
  ],
};
async function seed(uid: string) {
  await create_document_store(uid).saveDocuments([document]);
}
describe("portable library backup", () => {
  it("round trips chunked documents, notes and progress into another account without credentials", async () => {
    await seed("a");
    await AsyncStorage.setItem("firebase:authUser:private", "secret-token");
    await AsyncStorage.multiSet([
      [account_storage_key("votic.mobile.collections.v1", "a"), JSON.stringify(["Research"])],
      [
        account_storage_key("votic.mobile.activity.v1", "a"),
        JSON.stringify({
          version: 1,
          trackingStartedAt: 1,
          buckets: { "2026-10-18T10": { "doc-a": { reading: 60000, listening: 30000 } } },
          ask: [],
        }),
      ],
      [
        account_storage_key("@votic/pronunciation-dictionary/v1", "a"),
        JSON.stringify([{ id: "votic", term: "Votic", pronunciation: "voh tick" }]),
      ],
      [
        "votic.mobile.personalization-preferences.v1:a",
        JSON.stringify({ explanationStyle: "simple", highlightMode: "word", defaultPlaybackRate: 1.5 }),
      ],
    ]);
    const backup = await create_library_backup("a");
    expect(JSON.stringify(backup)).not.toContain("secret-token");
    await restore_library_backup("b", backup);
    expect((await create_document_store("b").loadDocuments())[0]).toMatchObject(document);
    expect((await create_document_store("a").loadDocuments())[0].plainText).toBe(document.plainText);
    const copy = await create_library_backup("b");
    expect(copy.collections).toEqual(["Research"]);
    expect(copy.pronunciations[0].term).toBe("Votic");
    expect(copy.activity.buckets["2026-10-18T10"]["doc-a"].listening).toBe(30000);
    expect(copy.preferences?.defaultPlaybackRate).toBe(1.5);
    await restore_library_backup("b", backup);
    expect(await create_document_store("b").loadDocuments()).toHaveLength(1);
  });
  it("keeps differing existing work and makes a stable copy on conflict", async () => {
    await seed("a");
    const backup = await create_library_backup("a");
    await create_document_store("b").saveDocuments([{ ...document, plainText: "Existing work" }]);
    await restore_library_backup("b", backup);
    await restore_library_backup("b", backup);
    const restored = await create_document_store("b").loadDocuments();
    expect(restored).toHaveLength(2);
    expect(restored[0].plainText).toBe("Existing work");
    expect(restored[1].savedPassages?.[0].note).toBe("Keep this note");
  });
  it("says a combined library would be too big instead of calling a valid backup unsupported", async () => {
    const small = (id: string) => ({ ...document, id, plainText: "Short text.", savedPassages: [] });
    await create_document_store("a").saveDocuments([small("from-backup-1"), small("from-backup-2")]);
    const backup = await create_library_backup("a");
    await create_document_store("b").saveDocuments(
      Array.from({ length: 1999 }, (_, index) => small(`existing-${index}`)),
    );
    await expect(restore_library_backup("b", backup)).rejects.toThrow(
      "Restoring this backup would give you 2001 documents; a library holds up to 2000.",
    );
    expect(await create_document_store("b").loadDocuments()).toHaveLength(1999);
  });
  it("replays a committed restore after storage interruption without losing another account", async () => {
    await seed("a");
    await seed("other");
    const backup = await create_library_backup("a");
    const real = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    const target = account_storage_key("votic.mobile.library.v2", "b");
    const spy = jest.spyOn(AsyncStorage, "setItem").mockImplementation(async (key, value) => {
      if (key === target) throw new Error("Disk temporarily unavailable");
      return real(key, value);
    });
    await expect(restore_library_backup("b", backup)).rejects.toThrow("Disk");
    spy.mockImplementation(real);
    expect(await library_restore_pending("b")).toBe(true);
    await resume_library_restores();
    expect(await library_restore_pending("b")).toBe(false);
    expect((await create_document_store("b").loadDocuments())[0]).toMatchObject(document);
    expect(await create_document_store("other").loadDocuments()).toHaveLength(1);
  });
  it("does not resurrect a deleting account from its restore journal", async () => {
    await seed("a");
    const backup = await create_library_backup("a");
    await mark_account_deletion("a");
    await expect(restore_library_backup("a", backup)).rejects.toThrow("not available");
  });
  it("fails a storage-capacity preflight before committing restore intent", async () => {
    await seed("a");
    const backup = await create_library_backup("a");
    await create_document_store("b").saveDocuments([{ ...document, plainText: "Existing work" }]);
    const real = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    const spy = jest.spyOn(AsyncStorage, "setItem").mockImplementation(async (key, value) => {
      if (key.includes(":reserve:")) throw new Error("Storage capacity reached");
      return real(key, value);
    });
    try {
      await expect(restore_library_backup("b", backup)).rejects.toThrow("capacity");
    } finally {
      spy.mockImplementation(real);
    }
    expect(await library_restore_pending("b")).toBe(false);
    expect((await create_document_store("b").loadDocuments()).map((d) => d.plainText)).toEqual([
      "Existing work",
    ]);
    expect(
      (await AsyncStorage.getAllKeys()).some((k) =>
        k.startsWith(account_storage_key("library-restore-stage.v1:", "b")),
      ),
    ).toBe(false);
  });
  it("rejects unknown versions, invalid metadata, duplicate documents and unsafe keys", async () => {
    await seed("a");
    const backup = await create_library_backup("a");
    for (const change of [
      { version: 3 },
      { documents: [{ ...document, progress: 2 }] },
      { documents: [document, document] },
    ])
      expect(() => parse_library_backup(JSON.stringify({ ...backup, ...change }))).toThrow();
    expect(() => parse_library_backup('{"__proto__":{"polluted":true}}')).toThrow();
  });
});

it("round trips retained deletions, source URLs and speech checkpoints without reviving deleted content", async () => {
  const retained = {
    ...document,
    sourceUrl: "https://example.com/original",
    deletedAt: Date.now(),
    nativeCheckpoints: { "session-hour": 12000 },
    savedPassages: [{ ...document.savedPassages[0], deletedAt: Date.now() }],
  };
  await create_document_store("a").saveDocuments([retained]);
  const backup = await create_library_backup("a");
  const parsed = parse_library_backup(JSON.stringify(backup));
  expect(parsed.documents[0]).toMatchObject({
    sourceUrl: retained.sourceUrl,
    deletedAt: retained.deletedAt,
    nativeCheckpoints: { "session-hour": 12000 },
  });
  await restore_library_backup("b", parsed);
  const restored = await create_document_store("b").loadDocuments();
  expect(restored[0].deletedAt).toBe(retained.deletedAt);
  expect(restored[0].savedPassages?.[0].deletedAt).toBe(retained.savedPassages[0].deletedAt);
});

it("reads legacy version-one backups and exports the recovery-aware version two", async () => {
  await seed("a");
  const exported = await create_library_backup("a");
  expect(exported.version).toBe(2);
  const legacy = parse_library_backup(JSON.stringify({ ...exported, version: 1 }));
  expect(legacy.documents[0].plainText).toBe(document.plainText);
  expect(legacy.version).toBe(2);
});
