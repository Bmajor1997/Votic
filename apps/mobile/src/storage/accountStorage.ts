import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityLog, parseLog } from "../activity/activityModel";

/** Undefined is used only for legacy storage/migration. App providers always pass their account. */
export function accountStorageKey(key: string, uid?: string) {
  return uid === undefined ? key : `votic.mobile.account:${encodeURIComponent(uid)}:${key}`;
}
const OWNER_KEY = "votic.mobile.legacy-library-owner.v1";
const LIBRARY_KEY = "votic.mobile.library.v2";
const OLD_LIBRARY_KEY = "votic.mobile.documents.v1";
const TEXT_PREFIX = "votic.mobile.document-text.v1:";
const COLLECTIONS_KEY = "votic.mobile.collections.v1";
export const LEGACY_ACTIVITY_KEY = "votic.mobile.activity.v1";
const CHUNK_CHARS = 500_000;
let recoveryQueue: Promise<void> = Promise.resolve();

type Owner = { uid: string; complete: boolean };
async function owner(): Promise<Owner | null> {
  const raw = await AsyncStorage.getItem(OWNER_KEY);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (typeof value?.uid !== "string" || typeof value.complete !== "boolean")
    throw new Error("Votic could not read the older library's ownership record.");
  return value;
}
export async function legacyRecoveryAvailable(uid: string) {
  const assigned = await owner();
  if (assigned && (assigned.uid !== uid || assigned.complete)) return false;
  const values = await AsyncStorage.multiGet([
    LIBRARY_KEY,
    OLD_LIBRARY_KEY,
    COLLECTIONS_KEY,
    LEGACY_ACTIVITY_KEY,
  ]);
  return values.some(([, value]) => value !== null);
}
function array(raw: string | null): any[] {
  const value = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("The older library could not be read. Its backup is unchanged.");
  return value;
}
function mergeActivity(current: ActivityLog | null, legacy: ActivityLog): ActivityLog {
  if (!current) return legacy;
  const buckets = { ...current.buckets };
  for (const [hour, documents] of Object.entries(legacy.buckets)) {
    const merged = { ...buckets[hour] };
    for (const [id, split] of Object.entries(documents)) {
      const previous = merged[id];
      // Taking the maximum makes a retried migration idempotent after an interrupted write.
      merged[id] = {
        reading: Math.max(previous?.reading ?? 0, split.reading),
        listening: Math.max(previous?.listening ?? 0, split.listening),
      };
    }
    buckets[hour] = merged;
  }
  const events = new Map([...legacy.ask, ...current.ask].map((event) => [JSON.stringify(event), event]));
  return {
    version: 1,
    trackingStartedAt: Math.min(current.trackingStartedAt, legacy.trackingStartedAt),
    buckets,
    ask: [...events.values()].sort((a, b) => a.at - b.at).slice(-5000),
  };
}

/** Explicit owner recovery only. Original device data is retained as a backup, never auto-adopted. */
export function recoverLegacyDeviceData(uid: string) {
  const recover = async () => {
    const assigned = await owner();
    if (assigned && assigned.uid !== uid) throw new Error("The older library belongs to another account.");
    if (assigned?.complete) return;
    await AsyncStorage.setItem(OWNER_KEY, JSON.stringify({ uid, complete: false }));
    const key = (name: string) => accountStorageKey(name, uid);
    const splitRaw = await AsyncStorage.getItem(LIBRARY_KEY);
    const legacy = array(splitRaw ?? (await AsyncStorage.getItem(OLD_LIBRARY_KEY)));
    const current = array(await AsyncStorage.getItem(key(LIBRARY_KEY)));
    const existing = new Set(current.map((document) => document.id));
    const imported = [];
    for (const document of legacy) {
      if (
        typeof document?.id !== "string" ||
        typeof document.title !== "string" ||
        typeof document.progress !== "number" ||
        !Number.isInteger(document.sentenceIndex) ||
        !Number.isInteger(document.wordIndex)
      )
        throw new Error("The older library contains unreadable metadata. Its backup is unchanged.");
      if (existing.has(document.id)) continue;
      const { plainText, ...metadata } = document;
      const count =
        splitRaw === null
          ? Math.max(1, Math.ceil((typeof plainText === "string" ? plainText.length : 0) / CHUNK_CHARS))
          : (document.textChunks ?? 1);
      if (!Number.isSafeInteger(count) || count < 1 || count > 1000)
        throw new Error("The older document is too large to recover safely.");
      if (splitRaw === null && typeof plainText !== "string")
        throw new Error("The older document text could not be read.");
      for (let chunk = 0; chunk < count; chunk += 1) {
        const name = TEXT_PREFIX + document.id + (chunk ? `:${chunk}` : "");
        const text =
          splitRaw === null
            ? plainText.slice(chunk * CHUNK_CHARS, (chunk + 1) * CHUNK_CHARS)
            : await AsyncStorage.getItem(name);
        if (text !== null) await AsyncStorage.setItem(key(name), text);
      }
      imported.push(count > 1 ? { ...metadata, textChunks: count } : metadata);
    }
    // Text first; even missing text keeps its notes/metadata for later recovery.
    await AsyncStorage.setItem(key(LIBRARY_KEY), JSON.stringify([...current, ...imported]));
    const collections = [
      ...array(await AsyncStorage.getItem(key(COLLECTIONS_KEY))),
      ...array(await AsyncStorage.getItem(COLLECTIONS_KEY)),
    ];
    if (collections.some((item) => typeof item !== "string"))
      throw new Error("The older collections could not be read.");
    await AsyncStorage.setItem(key(COLLECTIONS_KEY), JSON.stringify([...new Set(collections)]));
    const activityRaw = await AsyncStorage.getItem(LEGACY_ACTIVITY_KEY);
    if (activityRaw !== null) {
      const legacyActivity = parseLog(activityRaw);
      const currentRaw = await AsyncStorage.getItem(key(LEGACY_ACTIVITY_KEY));
      const currentActivity = parseLog(currentRaw);
      if (!legacyActivity || (currentRaw !== null && !currentActivity))
        throw new Error("The saved activity could not be read. Its backup is unchanged.");
      await AsyncStorage.setItem(
        key(LEGACY_ACTIVITY_KEY),
        JSON.stringify(mergeActivity(currentActivity, legacyActivity)),
      );
    }
    await AsyncStorage.setItem(OWNER_KEY, JSON.stringify({ uid, complete: true }));
  };
  const result = recoveryQueue.then(recover);
  recoveryQueue = result.catch(() => {});
  return result;
}
