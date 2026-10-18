import AsyncStorage from "@react-native-async-storage/async-storage";
import { account_storage_key } from "./accountStorage";
import { account_writable, write_account_data } from "./accountDeletion";
import { send_client_diagnostic } from "../api/voticApi";

const CONSENT = "diagnostics-consent.v1",
  PENDING = "diagnostics-pending.v1";
let owner: string | null = null;
let queue = Promise.resolve();
export function set_diagnostic_owner(uid: string | null) {
  owner = uid;
}
export async function diagnostic_consent(uid: string) {
  return (await AsyncStorage.getItem(account_storage_key(CONSENT, uid))) === "yes";
}
export async function set_diagnostic_consent(uid: string, enabled: boolean) {
  await write_account_data(uid, async () => {
    await AsyncStorage.setItem(account_storage_key(CONSENT, uid), enabled ? "yes" : "no");
    if (!enabled) await AsyncStorage.removeItem(account_storage_key(PENDING, uid));
  });
}
export function record_screen_failure() {
  const uid = owner;
  queue = queue
    .then(async () => {
      if (!uid || owner !== uid || !account_writable(uid) || !(await diagnostic_consent(uid))) return;
      await write_account_data(uid, async () => {
        const key = account_storage_key(PENDING, uid);
        const old = JSON.parse((await AsyncStorage.getItem(key)) || "null");
        const count =
          old && Date.now() - old.at < 86400000 && Number.isSafeInteger(old.count) ? old.count : 0;
        await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), count: Math.min(50, count + 1) }));
      });
    })
    .catch(() => {});
  return queue;
}
export function flush_diagnostics(uid: string) {
  queue = queue
    .then(async () => {
      if (owner !== uid || !account_writable(uid) || !(await diagnostic_consent(uid))) return;
      const key = account_storage_key(PENDING, uid);
      const pending = JSON.parse((await AsyncStorage.getItem(key)) || "null");
      if (!pending) return;
      if (
        !Number.isFinite(pending.at) ||
        pending.at > Date.now() ||
        !Number.isSafeInteger(pending.count) ||
        pending.count < 1 ||
        pending.count > 50 ||
        Date.now() - pending.at > 86400000
      ) {
        await AsyncStorage.removeItem(key);
        return;
      }
      await send_client_diagnostic(pending.count);
      await AsyncStorage.removeItem(key);
    })
    .catch(() => {});
  return queue;
}
