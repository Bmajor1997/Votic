import AsyncStorage from "@react-native-async-storage/async-storage";
import { account_storage_key } from "../storage/accountStorage";
import { write_account_data } from "../storage/accountDeletion";
import type { NoteDraft } from "./components/NoteEditor";
import type { NoteItem } from "./notesList";

export type RecoverableNote = { item: NoteItem; draft: NoteDraft; updatedAt: number };
const prefix = (uid: string) => account_storage_key("note-draft.v1:", uid);
const key = (uid: string, item: NoteItem) =>
  prefix(uid) + encodeURIComponent(item.document.id) + ":" + encodeURIComponent(item.passage.id);
const queues = new Map<string, Promise<unknown>>();
function serialized(uid: string, item: NoteItem, task: (key: string) => Promise<void>) {
  return serialized_key(uid, key(uid, item), task);
}
function serialized_key(uid: string, storageKey: string, task: (key: string) => Promise<void>) {
  const next = (queues.get(storageKey) || Promise.resolve())
    .catch(() => {})
    .then(() => write_account_data(uid, () => task(storageKey)));
  queues.set(storageKey, next);
  void next
    .finally(() => {
      if (queues.get(storageKey) === next) queues.delete(storageKey);
    })
    .catch(() => {});
  return next;
}
export function save_note_draft(uid: string, item: NoteItem, draft: NoteDraft) {
  // Drafts retain source association and passage metadata, never a second copy of the entire document.
  const safeItem = {
    document: {
      ...item.document,
      plainText: "",
      savedPassages: [],
      activity: undefined,
      nativeCheckpoints: undefined,
    },
    passage: item.passage,
  };
  return serialized(uid, item, async (storageKey) => {
    const existing = await AsyncStorage.getItem(storageKey);
    if (!existing && (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix(uid))).length >= 100)
      throw new Error("You have 100 unfinished notes. Save or discard a draft before starting another.");
    await AsyncStorage.setItem(storageKey, JSON.stringify({ item: safeItem, draft, updatedAt: Date.now() }));
  });
}
export function discard_note_draft(uid: string, item: NoteItem) {
  return serialized(uid, item, (storageKey) => AsyncStorage.removeItem(storageKey));
}
export async function load_note_drafts(uid: string): Promise<RecoverableNote[]> {
  await Promise.allSettled(
    [...queues.entries()].filter(([k]) => k.startsWith(prefix(uid))).map(([, pending]) => pending),
  );
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix(uid)));
  const records = await AsyncStorage.multiGet(keys);
  return records
    .flatMap(([, raw]) => {
      try {
        if (!raw || raw.length > 150_000) return [];
        const record = JSON.parse(raw);
        const d = record?.draft;
        if (
          !record.item?.document?.id ||
          !record.item?.passage?.id ||
          !Number.isFinite(record.updatedAt) ||
          typeof d?.note !== "string" ||
          d.note.length > 2000 ||
          typeof d.title !== "string" ||
          d.title.length > 100 ||
          typeof d.tags !== "string" ||
          d.tags.length > 240 ||
          !["note", "key-point", "question", "definition"].includes(d.noteType)
        )
          return [];
        return [record as RecoverableNote];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function discard_related_note_drafts(uid: string, documentId: string, passageId?: string) {
  const base = prefix(uid) + encodeURIComponent(documentId) + ":";
  const matches = (storageKey: string) =>
    passageId === undefined
      ? storageKey.startsWith(base)
      : storageKey === base + encodeURIComponent(passageId);
  const keys = [...new Set([...(await AsyncStorage.getAllKeys()), ...queues.keys()])].filter(matches);
  await Promise.all(
    keys.map((storageKey) => serialized_key(uid, storageKey, (k) => AsyncStorage.removeItem(k))),
  );
}
