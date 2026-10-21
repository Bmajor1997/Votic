import AsyncStorage from "@react-native-async-storage/async-storage";
import { account_storage_key } from "../storage/accountStorage";
import { write_account_data } from "../storage/accountDeletion";

const CHUNK = 500_000;
const key = (uid: string) => account_storage_key("ocr-review.v1", uid);
const prefix = (uid: string) => account_storage_key("ocr-review-chunk.v1:", uid);
/** Text is chunked below Android's per-value read limit; a new manifest commits only complete text. */
export async function store_ocr_review(uid: string, value: unknown | null) {
  await write_account_data(uid, async () => {
    if (value === null) await AsyncStorage.removeItem(key(uid));
    else {
      const raw = JSON.stringify(value);
      if (raw.length > 10_100_000)
        throw new Error(
          "Scan review exceeds the document size limit. Split the scan into smaller documents.",
        );
      const generation = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const pieces = split_review_text(raw);
      const count = pieces.length;
      const chunks: [string, string][] = pieces.map((text, at) => [
        prefix(uid) + generation + ":" + at,
        text,
      ]);
      await AsyncStorage.multiSet(chunks);
      await AsyncStorage.setItem(key(uid), JSON.stringify({ generation, count }));
    }
    await clean_ocr_chunks(uid);
  });
}
async function clean_ocr_chunks(uid: string) {
  const raw = await AsyncStorage.getItem(key(uid));
  const current = raw ? JSON.parse(raw) : null;
  const keep = current ? prefix(uid) + current.generation + ":" : null;
  const obsolete = (await AsyncStorage.getAllKeys()).filter(
    (k) => k.startsWith(prefix(uid)) && (!keep || !k.startsWith(keep)),
  );
  if (obsolete.length) await AsyncStorage.multiRemove(obsolete);
}
export async function load_ocr_review(uid: string): Promise<unknown | null> {
  const raw = await AsyncStorage.getItem(key(uid));
  if (!raw) return null;
  const manifest = JSON.parse(raw);
  if (
    !/^[a-z0-9-]{1,80}$/.test(manifest.generation) ||
    !Number.isInteger(manifest.count) ||
    manifest.count < 1 ||
    manifest.count > 21
  )
    throw new Error("Saved review is incomplete.");
  const chunks = await AsyncStorage.multiGet(
    Array.from({ length: manifest.count }, (_, at) => prefix(uid) + manifest.generation + ":" + at),
  );
  if (chunks.some(([, text]) => text === null || text.length > CHUNK))
    throw new Error("Saved review is incomplete.");
  return JSON.parse(chunks.map(([, text]) => text).join(""));
}

/** Native string bridges must never receive half a surrogate pair at a chunk edge. */
export function split_review_text(raw: string) {
  const chunks: string[] = [];
  for (let start = 0; start < raw.length;) {
    let end = Math.min(start + CHUNK, raw.length);
    const high = raw.charCodeAt(end - 1),
      low = raw.charCodeAt(end);
    if (high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff) end--;
    chunks.push(raw.slice(start, end));
    start = end;
  }
  return chunks;
}
