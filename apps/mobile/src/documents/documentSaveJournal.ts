import AsyncStorage from "@react-native-async-storage/async-storage";
import { account_storage_key } from "../storage/accountStorage";

const JOURNAL = "votic.mobile.document-save.v1";
const STAGE = "votic.mobile.document-save-stage.v1:";
type Entry = { target: string; stage: string };
type Journal = { version: 1; entries: Entry[] };
const journal_key = (uid?: string) => account_storage_key(JOURNAL, uid);
const stage_prefix = (uid?: string) => account_storage_key(STAGE, uid);

function valid_journal(value: Journal, uid?: string) {
  const text = account_storage_key("votic.mobile.document-text.v1:", uid);
  const metadata = account_storage_key("votic.mobile.library.v2", uid);
  return (
    value?.version === 1 &&
    Array.isArray(value.entries) &&
    value.entries.length > 0 &&
    value.entries.length <= 40_001 &&
    value.entries.every(
      (entry) =>
        typeof entry?.target === "string" &&
        (entry.target === metadata || entry.target.startsWith(text)) &&
        typeof entry.stage === "string" &&
        entry.stage.startsWith(stage_prefix(uid)),
    ) &&
    new Set(value.entries.map((entry) => entry.target)).size === value.entries.length &&
    value.entries.at(-1)?.target === metadata
  );
}

/** Complete an interrupted save before exposing or changing the library. Metadata commits last. */
export async function recover_document_save(uid?: string) {
  const raw = await AsyncStorage.getItem(journal_key(uid));
  if (raw === null) return;
  const journal = JSON.parse(raw) as Journal;
  if (!valid_journal(journal, uid)) throw new Error("The pending library save could not be read.");
  const stages = await AsyncStorage.multiGet(journal.entries.map((entry) => entry.stage));
  if (stages.some(([, value]) => value === null))
    throw new Error("The pending library save is incomplete. Your saved data has been kept.");
  const values: [string, string][] = journal.entries.map((entry, index) => [entry.target, stages[index][1]!]);
  await AsyncStorage.multiSet(values.slice(0, -1));
  const [key, value] = values[values.length - 1];
  await AsyncStorage.setItem(key, value);
  await AsyncStorage.removeItem(journal_key(uid));
  await AsyncStorage.multiRemove(journal.entries.map((entry) => entry.stage)).catch(() => {});
  return true;
}

/** Stage the complete replacement before changing any existing text; keep intent until commit succeeds. */
export async function commit_document_save(
  uid: string | undefined,
  texts: [string, string][],
  metadataKey: string,
  metadata: string,
) {
  const operation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const values: [string, string][] = [...texts, [metadataKey, metadata]];
  const entries = values.map(([target], index) => ({
    target,
    stage: `${stage_prefix(uid)}${operation}:${index}`,
  }));
  const raw = JSON.stringify({ version: 1, entries });
  if (new TextEncoder().encode(raw).byteLength > 1_500_000)
    throw new Error("This library save is too large to commit safely.");
  try {
    await AsyncStorage.multiSet(entries.map((entry, index) => [entry.stage, values[index][1]]));
    await AsyncStorage.setItem(journal_key(uid), raw);
    await recover_document_save(uid);
  } catch (error) {
    // Before intent is durable, only our disposable stages may have changed.
    const committed = await AsyncStorage.getItem(journal_key(uid)).catch(() => raw);
    if (committed !== raw)
      await AsyncStorage.multiRemove(entries.map((entry) => entry.stage)).catch(() => {});
    throw error;
  }
}
