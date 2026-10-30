import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  document_text_key,
  LIBRARY_KEY,
  MAX_DOCUMENT_CHUNKS,
  MAX_STORED_DOCUMENTS,
} from "../documents/documentStorage";
import { account_storage_key } from "./accountStorage";

export type DocumentUsage = { id: string; title: string; bytes: number; deleted: boolean };
export type AccountStorageUsage = { bytes: number; documents: DocumentUsage[] };
const utf8_bytes = (value: string) => new TextEncoder().encode(value).byteLength;

/** Logical UTF-8 value sizes, not SQLite allocation or the original imported file sizes. Read only. */
export async function read_account_storage_usage(uid: string): Promise<AccountStorageUsage> {
  if (!uid) throw new Error("Sign in to view your saved library storage.");
  const prefix = account_storage_key("", uid);
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
  const sizes = new Map<string, number>();
  let bytes = 0;
  let metadata: string | null = null;
  // Release large text chunks after each batch, instead of duplicating the entire library in memory.
  for (let at = 0; at < keys.length; at += 8) {
    for (const [key, value] of await AsyncStorage.multiGet(keys.slice(at, at + 8))) {
      if (value === null) continue;
      const size = utf8_bytes(value);
      sizes.set(key, size);
      bytes += size;
      if (key === account_storage_key(LIBRARY_KEY, uid)) metadata = value;
    }
  }
  if (metadata === null) return { bytes, documents: [] };
  const stored: unknown = JSON.parse(metadata);
  if (!Array.isArray(stored) || stored.length > MAX_STORED_DOCUMENTS)
    throw new Error("Saved document sizes could not be read. Your library has not been changed.");
  const documents = stored.map((entry): DocumentUsage => {
    const chunks = entry?.textChunks ?? 1;
    if (
      typeof entry?.id !== "string" ||
      typeof entry?.title !== "string" ||
      !Number.isInteger(chunks) ||
      chunks < 1 ||
      chunks > MAX_DOCUMENT_CHUNKS
    )
      throw new Error("Saved document sizes could not be read. Your library has not been changed.");
    let size = utf8_bytes(JSON.stringify(entry));
    for (let chunk = 0; chunk < chunks; chunk++) {
      const textSize = sizes.get(document_text_key(entry.id, chunk, uid));
      if (textSize === undefined)
        throw new Error("Some document text is unavailable. Your saved data has been kept.");
      size += textSize;
    }
    return { id: entry.id, title: entry.title, bytes: size, deleted: Boolean(entry.deletedAt) };
  });
  return { bytes, documents: documents.sort((a, b) => b.bytes - a.bytes) };
}

export function format_storage_bytes(bytes: number) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}
