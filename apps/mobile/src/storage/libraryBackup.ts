import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { empty_log, parse_log } from "../activity/activityModel";
import {
  create_document_store,
  document_text_key,
  LIBRARY_KEY,
  load_collections,
  TEXT_CHUNK_CHARS,
} from "../documents/documentStorage";
import { account_preferences_key, load_account_preferences } from "../onboarding/accountPreferences";
import { load_pronunciations } from "../reader/pronunciationDictionary";
import { account_storage_key, LEGACY_ACTIVITY_KEY } from "./accountStorage";
import { account_deletion_pending, account_writable, write_account_data } from "./accountDeletion";
import { LibraryBackup, merge_library_backup, parse_library_backup } from "./libraryBackupModel";

const MANIFEST = "library-restore.v1";
const STAGE = "library-restore-stage.v1:";
type Manifest = { version: 1; uid: string; entries: { target: string; stage: string }[] };
function writable(uid: string) {
  if (!uid || !account_writable(uid)) throw new Error("This account is not available for library restore.");
}
export async function create_library_backup(uid: string): Promise<LibraryBackup> {
  writable(uid);
  if (await library_restore_pending(uid)) throw new Error("Finish the interrupted restore first.");
  const store = create_document_store(uid);
  const documents = await store.loadDocuments();
  if (store.unavailableDocuments().length)
    throw new Error("Some saved documents cannot be read. Recover them before creating a complete backup.");
  const raw = await AsyncStorage.getItem(account_storage_key(LEGACY_ACTIVITY_KEY, uid));
  const activity = raw === null ? empty_log() : parse_log(raw);
  if (!activity) throw new Error("Saved activity could not be read. No incomplete backup was created.");
  const backup: LibraryBackup = {
    format: "votic-library",
    version: 1,
    id: Crypto.randomUUID(),
    createdAt: Date.now(),
    documents,
    collections: await load_collections(uid),
    activity,
    pronunciations: await load_pronunciations(uid),
    preferences: await load_account_preferences(uid),
  };
  return parse_library_backup(JSON.stringify(backup));
}
export function library_restore_pending(uid: string) {
  return AsyncStorage.getItem(account_storage_key(MANIFEST, uid)).then((value) => value !== null);
}
function permitted_target(uid: string, key: string) {
  return (
    [
      LIBRARY_KEY,
      "votic.mobile.collections.v1",
      LEGACY_ACTIVITY_KEY,
      "@votic/pronunciation-dictionary/v1",
    ].some((name) => key === account_storage_key(name, uid)) ||
    key === account_preferences_key(uid) ||
    key.startsWith(account_storage_key("votic.mobile.document-text.v1:", uid))
  );
}
async function finish_restore(uid: string) {
  writable(uid);
  const manifestKey = account_storage_key(MANIFEST, uid);
  const raw = await AsyncStorage.getItem(manifestKey);
  if (!raw) return;
  const m = JSON.parse(raw) as Manifest;
  const prefix = account_storage_key(STAGE, uid);
  if (
    m.version !== 1 ||
    m.uid !== uid ||
    !Array.isArray(m.entries) ||
    m.entries.length > 25_000 ||
    m.entries.some(
      (e) =>
        !e ||
        typeof e.target !== "string" ||
        !permitted_target(uid, e.target) ||
        typeof e.stage !== "string" ||
        !e.stage.startsWith(prefix),
    )
  )
    throw new Error("The interrupted restore record could not be read. Your library remains hidden.");
  // Validate all stages before the first change. The journal is removed only after every write succeeds.
  for (const entry of m.entries)
    if ((await AsyncStorage.getItem(entry.stage)) === null)
      throw new Error("The interrupted restore is missing saved data. Please contact Votic support.");
  for (const entry of m.entries) {
    writable(uid);
    const value = await AsyncStorage.getItem(entry.stage);
    if (value === null) throw new Error("Restore data is unavailable.");
    await AsyncStorage.setItem(entry.target, value);
  }
  writable(uid);
  await AsyncStorage.removeItem(manifestKey);
  await AsyncStorage.multiRemove(m.entries.map((e) => e.stage));
}
export async function restore_library_backup(
  uid: string,
  input: LibraryBackup,
  { restorePreferences = false } = {},
) {
  writable(uid);
  // Never trust a parsed object from a UI caller without validating it again.
  const backup = parse_library_backup(JSON.stringify(input));
  if (await library_restore_pending(uid)) throw new Error("Finish the interrupted restore first.");
  const merged = merge_library_backup(await create_library_backup(uid), backup);
  if (restorePreferences && backup.preferences) merged.preferences = backup.preferences;
  parse_library_backup(JSON.stringify(merged));
  const entries: [string, string][] = [];
  const metadata = merged.documents.map(({ plainText, ...doc }) => {
    const chunks = Math.max(1, Math.ceil(plainText.length / TEXT_CHUNK_CHARS));
    for (let i = 0; i < chunks; i++)
      entries.push([
        document_text_key(doc.id, i, uid),
        plainText.slice(i * TEXT_CHUNK_CHARS, (i + 1) * TEXT_CHUNK_CHARS),
      ]);
    return chunks > 1 ? { ...doc, textChunks: chunks } : doc;
  });
  const scoped = (key: string) => account_storage_key(key, uid);
  entries.push(
    [scoped("votic.mobile.collections.v1"), JSON.stringify(merged.collections)],
    [scoped(LEGACY_ACTIVITY_KEY), JSON.stringify(merged.activity)],
    [scoped("@votic/pronunciation-dictionary/v1"), JSON.stringify(merged.pronunciations)],
  );
  if (merged.preferences) entries.push([account_preferences_key(uid), JSON.stringify(merged.preferences)]);
  // Metadata is committed last; new text chunks never replace existing differing documents.
  entries.push([scoped(LIBRARY_KEY), JSON.stringify(metadata)]);
  if (entries.length > 25_000 || entries.some(([, v]) => new TextEncoder().encode(v).byteLength > 1_500_000))
    throw new Error("This library is too large to restore safely on this device.");
  // Do not stage unchanged document text. Reserve space for destination growth before committing intent,
  // so a near-full AsyncStorage database fails while the original library is still untouched.
  const changed: [string, string][] = [];
  let growth = 0;
  for (const [key, value] of entries) {
    const previous = await AsyncStorage.getItem(key);
    if (previous === value) continue;
    changed.push([key, value]);
    growth +=
      Math.max(
        0,
        new TextEncoder().encode(value).byteLength - new TextEncoder().encode(previous || "").byteLength,
      ) + 4096;
  }
  entries.splice(0, entries.length, ...changed);
  if (!entries.length) return;
  const operation = Crypto.randomUUID();
  const reserveKeys: string[] = [];
  const manifest: Manifest = {
    version: 1,
    uid,
    entries: entries.map(([target], i) => ({ target, stage: scoped(STAGE + operation + ":" + i) })),
  };
  const work = await write_account_data(uid, async () => {
    try {
      for (const [i, [, value]] of entries.entries()) {
        writable(uid);
        await AsyncStorage.setItem(manifest.entries[i].stage, value);
      }
      for (let bytes = growth; bytes > 0; bytes -= 500_000) {
        writable(uid);
        const key = scoped(STAGE + operation + ":reserve:" + reserveKeys.length);
        reserveKeys.push(key);
        await AsyncStorage.setItem(key, " ".repeat(Math.min(bytes, 500_000)));
      }
      await AsyncStorage.multiRemove(reserveKeys);
      writable(uid);
      await AsyncStorage.setItem(scoped(MANIFEST), JSON.stringify(manifest));
      await finish_restore(uid);
    } catch (error) {
      // Before the journal exists, no original data has changed; clean up an abandoned staging attempt.
      if (!(await library_restore_pending(uid)))
        await AsyncStorage.multiRemove([...manifest.entries.map((e) => e.stage), ...reserveKeys]);
      throw error;
    }
    return true;
  });
  if (!work) writable(uid);
}
/** Runs before account data providers mount; a failed replay keeps all libraries hidden. */
export async function resume_library_restores() {
  const keys = await AsyncStorage.getAllKeys();
  const manifests = keys.filter(
    (key) => key.startsWith("votic.mobile.account:") && key.endsWith(":" + MANIFEST),
  );
  for (const key of manifests) {
    const uid = decodeURIComponent(key.slice("votic.mobile.account:".length, -MANIFEST.length - 1));
    if ((await account_deletion_pending(uid)) || !account_writable(uid)) {
      await AsyncStorage.multiRemove(
        keys.filter((k) => k === key || k.startsWith(account_storage_key(STAGE, uid))),
      );
      continue;
    }
    await write_account_data(uid, () => finish_restore(uid));
  }
  // Stages left before a journal was committed, or after a successful commit, contain no unique work.
  const remaining = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(
    remaining.filter((k) => k.startsWith("votic.mobile.account:") && k.includes(":" + STAGE)),
  );
}
