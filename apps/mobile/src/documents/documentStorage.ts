import AsyncStorage from "@react-native-async-storage/async-storage";
import { account_storage_key } from "../storage/accountStorage";
import { write_account_data } from "../storage/accountDeletion";
import { VoticDocument } from "./types";
const LEGACY_KEY = "votic.mobile.documents.v1",
  COLLECTIONS_KEY = "votic.mobile.collections.v1";
// Metadata changes constantly (progress, notes); document text almost never does, so they are stored apart.
export const LIBRARY_KEY = "votic.mobile.library.v2";
const TEXT_KEY_PREFIX = "votic.mobile.document-text.v1:";
// Android cannot read back a single stored value much over 2 MB, so long texts are split into chunks.
// 500,000 characters is at most 1.5 MB of UTF-8.
export const TEXT_CHUNK_CHARS = 500_000;
export function document_text_key(id: string, chunk = 0, uid?: string) {
  return account_storage_key(TEXT_KEY_PREFIX, uid) + id + (chunk ? ":" + chunk : "");
}
function chunk_count(text: string) {
  return Math.max(1, Math.ceil(text.length / TEXT_CHUNK_CHARS));
}
// `textChunks` is omitted for single-chunk texts, which keeps their stored form unchanged.
type StoredDocument = Omit<VoticDocument, "plainText"> & { textChunks?: number };
function metadata({ plainText, ...document }: VoticDocument): StoredDocument {
  const chunks = chunk_count(plainText);
  return chunks > 1 ? { ...document, textChunks: chunks } : document;
}

function parse_array(raw: string | null, label: string) {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Saved ${label} data could not be read.`);
  }
  if (!Array.isArray(value)) throw new Error(`Saved ${label} data is invalid.`);
  return value;
}

/** Loads and saves the document library, rewriting a document's text only when it changes. */
export function create_document_store(uid?: string) {
  const libraryKey = account_storage_key(LIBRARY_KEY, uid);
  const legacyKey = account_storage_key(LEGACY_KEY, uid);
  const textPrefix = account_storage_key(TEXT_KEY_PREFIX, uid);
  function text_chunk_keys(id: string, chunks: number) {
    return Array.from({ length: chunks }, (_, chunk) => document_text_key(id, chunk, uid));
  }
  function text_entries(document: VoticDocument): [string, string][] {
    return text_chunk_keys(document.id, chunk_count(document.plainText)).map((key, chunk) => [
      key,
      document.plainText.slice(chunk * TEXT_CHUNK_CHARS, (chunk + 1) * TEXT_CHUNK_CHARS),
    ]);
  }

  const persistedTexts = new Map<string, string>();
  // Documents whose text could not be read. Their metadata is written back unchanged on every save and
  // their text is never deleted, so a device or storage problem cannot turn into lost notes.
  let unavailable: StoredDocument[] = [];

  async function migrate_legacy_documents() {
    const value = parse_array(await AsyncStorage.getItem(legacyKey), "document");
    const documents = value.filter(valid);
    if (documents.length !== value.length) throw new Error("Some saved document data is invalid.");
    if (!documents.length) return [];
    // Texts first, then metadata, then drop the legacy copy, so an interrupted migration never loses data.
    await AsyncStorage.multiSet(documents.flatMap(text_entries));
    await AsyncStorage.setItem(libraryKey, JSON.stringify(documents.map(metadata)));
    await AsyncStorage.removeItem(legacyKey);
    return documents;
  }

  async function load_documents(): Promise<VoticDocument[]> {
    const raw = await AsyncStorage.getItem(libraryKey);
    unavailable = [];
    const documents = raw === null ? await migrate_legacy_documents() : await load_split_documents(raw);
    persistedTexts.clear();
    for (const document of documents) persistedTexts.set(document.id, document.plainText);
    return documents;
  }

  /** Titles of saved documents whose text could not be read in the last load. */
  function unavailable_documents() {
    return unavailable.map((document) => document.title);
  }

  async function read_text(document: StoredDocument, values: Map<string, string | null> | null) {
    const keys = text_chunk_keys(document.id, document.textChunks ?? 1);
    // Without a batch result (the batch read failed), read this document on its own so one bad
    // value only affects its own document.
    const chunks = values
      ? keys.map((key) => values.get(key))
      : (await AsyncStorage.multiGet(keys)).map(([, value]) => value);
    return chunks.every((chunk) => typeof chunk === "string") ? chunks.join("") : null;
  }

  async function load_split_documents(raw: string) {
    const value = parse_array(raw, "document");
    if (!value.every(valid_metadata)) throw new Error("Some saved document data is invalid.");
    const stored = value as StoredDocument[];
    let values: Map<string, string | null> | null = null;
    try {
      values = new Map(
        await AsyncStorage.multiGet(
          stored.flatMap((document) => text_chunk_keys(document.id, document.textChunks ?? 1)),
        ),
      );
    } catch {
      values = null;
    }
    const documents: VoticDocument[] = [];
    for (const document of stored) {
      const text = await read_text(document, values).catch(() => null);
      if (text === null) {
        unavailable.push(document);
        continue;
      }
      const { textChunks: _chunks, ...rest } = document;
      documents.push({ ...rest, plainText: text } as VoticDocument);
    }
    void AsyncStorage.removeItem(legacyKey).catch(() => {});
    // Finish snapshot-based cleanup before callers can save newly imported documents.
    await remove_orphaned_texts(stored).catch(() => {});
    return documents;
  }

  /** Removes text left behind by an interrupted save, which no saved document refers to. */
  async function remove_orphaned_texts(stored: StoredDocument[]) {
    const expected = new Set(
      stored.flatMap((document) => text_chunk_keys(document.id, document.textChunks ?? 1)),
    );
    // An unreadable document keeps every key that could belong to it, in case its metadata is what is wrong.
    const kept = new Set(unavailable.map((document) => document_text_key(document.id, 0, uid)));
    const orphaned = (await AsyncStorage.getAllKeys()).filter(
      (key) => key.startsWith(textPrefix) && !expected.has(key) && !kept.has(key.replace(/:\d+$/, "")),
    );
    if (orphaned.length) await AsyncStorage.multiRemove(orphaned);
  }

  async function save_documents(documents: VoticDocument[]) {
    // Text is written before the metadata that references it, and removed only after.
    const changed = documents.filter((document) => persistedTexts.get(document.id) !== document.plainText);
    const replaced = changed.flatMap((document) => {
      const previous = persistedTexts.get(document.id);
      return previous === undefined
        ? []
        : [{ id: document.id, from: chunk_count(previous), to: chunk_count(document.plainText) }];
    });
    if (changed.length) {
      await AsyncStorage.multiSet(changed.flatMap(text_entries));
      for (const document of changed) persistedTexts.set(document.id, document.plainText);
    }
    await AsyncStorage.setItem(
      libraryKey,
      JSON.stringify(
        documents
          .map(metadata)
          .concat(unavailable.filter((stored) => !documents.some((document) => document.id === stored.id))),
      ),
    );
    const ids = new Set(documents.map((document) => document.id));
    const removed = [...persistedTexts.entries()].filter(([id]) => !ids.has(id));
    const staleKeys = [
      ...removed.flatMap(([id, text]) => text_chunk_keys(id, chunk_count(text))),
      // A text that got shorter leaves its extra chunks behind.
      ...replaced.flatMap(({ id, from, to }) => text_chunk_keys(id, from).slice(to)),
    ];
    if (staleKeys.length) {
      await AsyncStorage.multiRemove(staleKeys);
      for (const [id] of removed) persistedTexts.delete(id);
    }
  }

  return {
    loadDocuments: () => write_account_data(uid, load_documents).then((value) => value ?? []),
    saveDocuments: (documents: VoticDocument[]) => write_account_data(uid, () => save_documents(documents)),
    unavailableDocuments: unavailable_documents,
  };
}

export async function load_collections(uid?: string): Promise<string[]> {
  const value = parse_array(
    await AsyncStorage.getItem(account_storage_key(COLLECTIONS_KEY, uid)),
    "collection",
  );
  if (value.some((item) => typeof item !== "string"))
    throw new Error("Some saved collection data is invalid.");
  return value.map((item) => (item as string).trim()).filter(Boolean);
}
export async function save_collections(collections: string[], uid?: string) {
  await write_account_data(uid, () =>
    AsyncStorage.setItem(account_storage_key(COLLECTIONS_KEY, uid), JSON.stringify(collections)),
  );
}
function valid_metadata(value: any): value is StoredDocument {
  return (
    value &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.progress === "number" &&
    Number.isInteger(value.sentenceIndex) &&
    Number.isInteger(value.wordIndex) &&
    (value.textChunks === undefined || (Number.isSafeInteger(value.textChunks) && value.textChunks >= 1))
  );
}
function valid(value: any): value is VoticDocument {
  return valid_metadata(value) && typeof (value as any).plainText === "string";
}
