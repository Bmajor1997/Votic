import { act, renderHook } from "@testing-library/react-native";
import { expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppProviders, test_document } from "../renderWithProviders";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import {
  DELETED_RETENTION_MS,
  expire_library,
  live_library,
  prune_deleted,
} from "../../src/documents/libraryRecovery";
import { discard_note_draft, load_note_drafts, save_note_draft } from "../../src/notes/draftStorage";
import { erase_local_account } from "../../src/storage/accountDeletion";
import { load_ocr_review, split_review_text, store_ocr_review } from "../../src/documents/ocrReviewStorage";
import { safe_source_url } from "../../src/documents/sourceInformation";

const note = {
  id: "note",
  sentenceIndex: 0,
  text: "Source",
  note: "Saved",
  createdAt: 1,
  updatedAt: 1,
  tags: ["study"],
  noteType: "question" as const,
};
it("recovers a document with notes and restores standalone notes without duplicating them", async () => {
  const hook = await renderHook(() => useDocumentLibrary(), { wrapper: AppProviders });
  let id = "";
  await act(async () => {
    id = hook.result.current.addTextDocument("original.txt", "Text.").id;
  });
  await act(async () => hook.result.current.savePassage(id, note));
  await act(async () => hook.result.current.removeDocument(id));
  expect(hook.result.current.documents).toHaveLength(0);
  expect(hook.result.current.activeDocument).toBeNull();
  expect(hook.result.current.recovery.documents[0].savedPassages).toEqual([note]);
  await act(async () => hook.result.current.recovery.restore(id));
  expect(hook.result.current.documents[0].savedPassages).toEqual([note]);
  await act(async () => hook.result.current.removePassage(id, note.id));
  expect(hook.result.current.documents[0].savedPassages).toEqual([]);
  expect(hook.result.current.recovery.notes).toHaveLength(1);
  await act(async () => hook.result.current.recovery.restore(id, note.id));
  expect(hook.result.current.documents[0].savedPassages?.[0].tags).toEqual(["study"]);
  await act(async () => hook.result.current.recovery.permanentlyDelete(id));
  expect(hook.result.current.documents).toHaveLength(1); // permanent deletion cannot target a live document
  await act(async () => hook.result.current.removeDocument(id));
  await act(async () => hook.result.current.recovery.permanentlyDelete(id));
  expect(hook.result.current.recovery.documents).toEqual([]);
});
it("expires retained items after 30 days and removes quick-note text from live views", () => {
  const now = Date.now();
  const document = test_document("quick", "Quick Notes", {
    notebookKind: "quick-notes",
    plainText: "Saved",
    savedPassages: [{ ...note, deletedAt: now }],
  });
  expect(live_library([document])[0].plainText).toBe("");
  expect(prune_deleted([document], now + DELETED_RETENTION_MS)[0].savedPassages).toEqual([]);
  expect(prune_deleted([{ ...document, deletedAt: now }], now + DELETED_RETENTION_MS)).toEqual([]);
});
it("persists account-scoped drafts and serializes save/discard without resurrecting one", async () => {
  const item = { document: test_document("book", "Book"), passage: note };
  const draft = { title: "Draft", note: "Changed", noteType: "question" as const, tags: "study, later" };
  await save_note_draft("A", item, draft);
  expect((await load_note_drafts("A"))[0].draft).toEqual(draft);
  expect(await load_note_drafts("B")).toEqual([]);
  const saving = save_note_draft("A", item, { ...draft, note: "Newer" });
  await discard_note_draft("A", item);
  await saving;
  expect(await load_note_drafts("A")).toEqual([]);
  await save_note_draft("A", item, draft);
  await erase_local_account("A");
  expect(await load_note_drafts("A")).toEqual([]);
});
it("chunks long OCR reviews, retains the prior review on failed writes, and isolates/deletes accounts", async () => {
  const review = {
    id: "scan",
    pages: ["日本語😀".repeat(140000), "Second page"],
    name: "Scan",
    origin: "scan",
    playbackRate: 1,
  };
  await store_ocr_review("A", review);
  expect(await load_ocr_review("A")).toEqual(review);
  expect(await load_ocr_review("B")).toBeNull();
  jest.mocked(AsyncStorage.multiSet).mockRejectedValueOnce(new Error("disk full"));
  await expect(store_ocr_review("A", { ...review, pages: ["New"] })).rejects.toThrow("disk full");
  expect(await load_ocr_review("A")).toEqual(review);
  await erase_local_account("A");
  expect(await load_ocr_review("A")).toBeNull();
});
it("offers only valid public web originals without credentials or private cache paths", () => {
  for (const value of [
    "file:///private/scan.jpg",
    "javascript:alert(1)",
    "https://name:password@example.com",
    "http://127.0.0.1/a",
    "http://localhost/a",
    "https://[::1]/",
  ])
    expect(safe_source_url(value)).toBeNull();
  expect(safe_source_url("https://example.com/article?q=2")).toBe("https://example.com/article?q=2");
});

it("removes associated note drafts when retention expires, while keeping another document's draft", async () => {
  const now = Date.now();
  const expired = test_document("expired", "Expired", { deletedAt: now - DELETED_RETENTION_MS });
  const live = test_document("live", "Live");
  const draft = { note: "Unfinished", title: "Draft", tags: "study", noteType: "note" as const };
  await save_note_draft("A", { document: expired, passage: note }, draft);
  await save_note_draft("A", { document: live, passage: note }, draft);
  expect(await expire_library([expired, live], "A", now)).toEqual([expect.objectContaining({ id: "live" })]);
  expect((await load_note_drafts("A")).map((record) => record.item.document.id)).toEqual(["live"]);
});

it("keeps surrogate pairs intact across native OCR storage chunk boundaries", () => {
  const raw = "a".repeat(499999) + "😀tail";
  const chunks = split_review_text(raw);
  expect(chunks[0]).toHaveLength(499999);
  expect(chunks[1]).toBe("😀tail");
  expect(chunks.join("")).toBe(raw);
});

it("stops a Quick Notes playback queue before removing one of its narrated notes", async () => {
  const playback = jest.requireActual<typeof import("../../src/playback/notificationPlayback")>(
    "../../src/playback/notificationPlayback",
  );
  let playingDocument = "";
  const stop = jest.fn(async () => {});
  const player = {
    start: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    stop,
    get_state: () => ({ documentId: playingDocument }),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  };
  jest.spyOn(playback, "notification_player").mockReturnValue(player);
  const hook = await renderHook(() => useDocumentLibrary(), { wrapper: AppProviders });
  await act(async () => hook.result.current.addQuickNote(note));
  playingDocument = hook.result.current.documents[0].id;
  stop.mockClear();
  await act(async () => hook.result.current.removePassage(playingDocument, note.id));
  expect(stop).toHaveBeenCalled();
  expect(hook.result.current.documents[0].plainText).toBe("");
  expect(hook.result.current.documents[0].savedPassages).toEqual([]);
  expect(hook.result.current.recovery.notes).toHaveLength(1);
});
