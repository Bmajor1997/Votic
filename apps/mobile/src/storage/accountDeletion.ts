import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING = "votic.mobile.pending-deletion.v1:";
const blocked = new Set<string>();
const writes = new Map<string, Set<Promise<unknown>>>();
let remotelyDeleted: (() => void) | null = null;

export function account_writable(uid?: string | null) {
  return !uid || !blocked.has(uid);
}
export function write_account_data<T>(
  uid: string | undefined,
  task: () => Promise<T>,
): Promise<T | undefined> {
  if (!uid) return task();
  if (blocked.has(uid)) return Promise.resolve(undefined);
  const pending = writes.get(uid) || new Set<Promise<unknown>>();
  writes.set(uid, pending);
  const work = Promise.resolve().then(() => (blocked.has(uid) ? undefined : task()));
  pending.add(work);
  void work
    .finally(() => {
      pending.delete(work);
      if (!pending.size) writes.delete(uid);
    })
    .catch(() => {});
  return work;
}
export async function mark_account_deletion(uid: string) {
  await AsyncStorage.setItem(PENDING + encodeURIComponent(uid), "1");
  blocked.add(uid);
  await Promise.allSettled([...(writes.get(uid) || [])]);
}
export async function account_deletion_pending(uid: string) {
  return (await AsyncStorage.getItem(PENDING + encodeURIComponent(uid))) !== null;
}
export async function erase_local_account(uid: string) {
  blocked.add(uid);
  await Promise.allSettled([...(writes.get(uid) || [])]);
  const prefix = `votic.mobile.account:${encodeURIComponent(uid)}:`;
  const specific = new Set([
    `votic.mobile.onboarding.v1:${uid}`,
    `votic.mobile.personalization-preferences.v1:${uid}`,
    `votic.mobile.walkthrough.v1:${uid}`,
  ]);
  const ownerKeys = ["votic.mobile.legacy-library-owner.v1", "votic.mobile.legacy-library-auto-owner.v1"];
  const owners = await AsyncStorage.multiGet(ownerKeys);
  // An explicit recovery owner wins over the older automatic-migration candidate.
  const rawOwner = owners[0][1] !== null ? owners[0][1] : owners[1][1];
  let owned = false;
  try {
    owned = Boolean(rawOwner && JSON.parse(rawOwner)?.uid === uid);
  } catch {
    /* Unknown ownership is not permission to erase someone else's backup. */
  }
  const legacyKeys = new Set([
    "votic.mobile.library.v2",
    "votic.mobile.documents.v1",
    "votic.mobile.collections.v1",
    "votic.mobile.activity.v1",
    "@votic/pronunciation-dictionary/v1",
    "votic.mobile.purpose.v1",
    "votic.mobile.explanation-style.v1",
    "votic.mobile.default-playback-rate.v1",
  ]);
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) =>
      key.startsWith(prefix) ||
      specific.has(key) ||
      (owned && (legacyKeys.has(key) || key.startsWith("votic.mobile.document-text.v1:"))) ||
      owners.some(([ownerKey, raw]) => {
        try {
          return key === ownerKey && raw && JSON.parse(raw)?.uid === uid;
        } catch {
          return false;
        }
      }),
  );
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
export async function finish_local_deletion(uid: string) {
  await erase_local_account(uid);
  await AsyncStorage.removeItem(PENDING + encodeURIComponent(uid));
  // Keep old closures blocked for this process; a deleted Firebase UID cannot sign in again.
}
export async function resume_local_deletions() {
  let recovered = false;
  for (const key of await AsyncStorage.getAllKeys()) {
    if (!key.startsWith(PENDING)) continue;
    recovered = true;
    const uid = decodeURIComponent(key.slice(PENDING.length));
    await erase_local_account(uid);
  }
  return recovered;
}
export function on_remote_account_deletion(listener: (() => void) | null) {
  remotelyDeleted = listener;
}
export function notify_remote_account_deletion() {
  remotelyDeleted?.();
}

/** Test-only lifecycle reset; callers must also clear their fake AsyncStorage. */
export function reset_account_deletion_state() {
  blocked.clear();
  writes.clear();
  remotelyDeleted = null;
}
