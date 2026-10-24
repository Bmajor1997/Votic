import { Directory, File, Paths } from "expo-file-system";
import { digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto";
import { Platform } from "react-native";

// Web capture still works within a tab. Native drafts use durable app-private storage, never cache.
const webPhotos = new Map<string, string>();
async function folder(uid: string) {
  const owner = await digestStringAsync(CryptoDigestAlgorithm.SHA256, uid);
  return new Directory(Paths.document, "ScanDrafts", owner);
}
export async function scan_page_uri(uid: string, id: string) {
  if (!/^page-[a-z0-9-]{1,100}\.jpg$/.test(id)) throw new Error("Invalid scan photo.");
  if (Platform.OS === "web") return webPhotos.get(`${uid}:${id}`) || "";
  return new File(await folder(uid), id).uri;
}
export async function persist_scan_photo(uid: string, id: string, uri: string) {
  if (Platform.OS === "web") {
    webPhotos.set(`${uid}:${id}`, uri);
    return uri;
  }
  const directory = await folder(uid);
  directory.create({ intermediates: true, idempotent: true });
  const source = new File(uri);
  if (!source.exists || source.size > 12_000_000)
    throw new Error("This photo is unavailable or too large. Retake the page.");
  const target = new File(directory, id);
  source.copy(target);
  return target.uri;
}
/** Called on account erasure even if a prior manifest write failed, so orphan photos are erased too. */
export async function delete_scan_photos(uid: string) {
  if (Platform.OS === "web") {
    for (const key of webPhotos.keys()) if (key.startsWith(`${uid}:`)) webPhotos.delete(key);
    return;
  }
  const directory = await folder(uid);
  if (directory.exists) directory.delete();
}
/** Removes one replaced or removed page photo, only after the draft that no longer uses it has been saved. */
export async function delete_scan_photo(uid: string, id: string) {
  if (!/^page-[a-z0-9-]{1,100}\.jpg$/.test(id)) return;
  if (Platform.OS === "web") {
    webPhotos.delete(`${uid}:${id}`);
    return;
  }
  const file = new File(await folder(uid), id);
  if (file.exists) file.delete();
}
