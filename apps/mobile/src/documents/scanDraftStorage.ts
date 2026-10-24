import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { account_storage_key } from "../storage/accountStorage";
import { write_account_data } from "../storage/accountDeletion";
import { delete_scan_photos, scan_page_uri } from "./scanDraftFiles";
import { load_ocr_review, store_ocr_review } from "./ocrReviewStorage";
import { ScanDraft, validate_scan_draft } from "./scanDraftModel";

const key = (uid: string) => account_storage_key("scan-draft.v1", uid);
const queues = new Map<string, Promise<unknown>>();
const webDrafts = new Map<string, ScanDraft>();
function serialized<T>(uid: string, work: () => Promise<T>) {
  const next = (queues.get(uid) || Promise.resolve()).catch(() => {}).then(work);
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => {});
  return next;
}
export async function load_scan_draft(uid: string): Promise<ScanDraft | null> {
  await queues.get(uid)?.catch(() => {});
  if (Platform.OS === "web") return webDrafts.get(uid) ?? null;
  const draft = await load_ocr_review(uid, "scan-draft");
  if (!draft) return null;
  validate_scan_draft(draft);
  const pages = await Promise.all(
    draft.pages.map(async (page) => ({ ...page, uri: await scan_page_uri(uid, page.id) })),
  );
  return { ...draft, pages };
}
export function store_scan_draft(uid: string, draft: ScanDraft) {
  validate_scan_draft(draft);
  return serialized(uid, () =>
    write_account_data(uid, async () => {
      if (Platform.OS === "web") webDrafts.set(uid, draft);
      else await store_ocr_review(uid, draft, "scan-draft");
      // Keep replaced photos until handoff/discard. Pruning here could race a newly staged capture.
    }),
  );
}
export function clear_scan_draft(uid: string) {
  return serialized(uid, () => write_account_data(uid, () => erase_scan_draft(uid)));
}
/** Account deletion calls this after blocking and draining writers; no new account write is allowed. */
export async function erase_scan_draft(uid: string) {
  await delete_scan_photos(uid);
  const prefix = account_storage_key("scan-draft-chunk.v1:", uid);
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k === key(uid) || k.startsWith(prefix));
  if (keys.length) await AsyncStorage.multiRemove(keys);
  webDrafts.delete(uid);
}
