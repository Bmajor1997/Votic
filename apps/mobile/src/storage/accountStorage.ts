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

/** The account used to explore Votic in development and preview builds without Firebase. */
export const DEVELOPMENT_UID = "development";
/** Decided once, on the first launch of this version: which account (if any) was already signed in. */
const AUTO_OWNER_KEY = "votic.mobile.legacy-library-auto-owner.v1";
/** The development account copies the older library without claiming it, and only once. */
const DEVELOPMENT_COPY_KEY = "legacy-library-copied.v1";

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
  if (uid === DEVELOPMENT_UID) {
    // Never copies a library a real account has already claimed, and never copies twice.
    if (assigned?.complete) return false;
    if ((await AsyncStorage.getItem(accountStorageKey(DEVELOPMENT_COPY_KEY, uid))) !== null) return false;
  } else if (assigned && (assigned.uid !== uid || assigned.complete)) return false;
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

/**
 * Whether this account should get the older shared library automatically: only the account that was already
 * signed in when this version first ran (the person who was using Votic on this device), or the development
 * account, which copies without claiming. Anyone else can still recover it from Settings.
 */
export async function legacyAutoRecoveryEligible(uid: string, sessionRestored: boolean) {
  if (uid !== DEVELOPMENT_UID) {
    const raw = await AsyncStorage.getItem(AUTO_OWNER_KEY);
    let decided: string | null;
    if (raw === null) {
      decided = sessionRestored ? uid : null;
      await AsyncStorage.setItem(AUTO_OWNER_KEY, JSON.stringify({ uid: decided }));
    } else decided = JSON.parse(raw)?.uid ?? null;
    if (decided !== uid) return false;
  }
  return legacyRecoveryAvailable(uid);
}

/** Original device data is always retained as a backup. */
export function recoverLegacyDeviceData(uid: string) {
  const claims = uid !== DEVELOPMENT_UID;
  const recover = async () => {
    const assigned = await owner();
    if (claims && assigned && assigned.uid !== uid)
      throw new Error("The older library belongs to another account.");
    if (assigned?.complete) return;
    // The development account copies without becoming the owner, so a real account can still claim it later.
    if (claims) await AsyncStorage.setItem(OWNER_KEY, JSON.stringify({ uid, complete: false }));
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
    if (claims) await AsyncStorage.setItem(OWNER_KEY, JSON.stringify({ uid, complete: true }));
    else await AsyncStorage.setItem(accountStorageKey(DEVELOPMENT_COPY_KEY, uid), "1");
  };
  const result = recoveryQueue.then(recover);
  recoveryQueue = result.catch(() => {});
  return result;
}
