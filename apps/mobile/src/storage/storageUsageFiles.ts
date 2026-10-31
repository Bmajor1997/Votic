import { Directory, File, Paths } from "expo-file-system";
import { CryptoDigestAlgorithm, digestStringAsync } from "expo-crypto";
import { Platform } from "react-native";

// Only Votic's known temporary import/export locations. Never sweep all of Paths.cache/document.
const TEMP_FOLDERS = ["DocumentPicker", "Camera", "LibraryBackups"];
export const TEMP_RETENTION_MS = 60 * 60 * 1000;
export type TemporaryUsage = { bytes: number; clearableBytes: number };

function files_in(directory: Directory, root = directory.uri, depth = 0): File[] {
  if (!directory.exists) return [];
  if (depth > 8) throw new Error("Temporary folder could not be measured.");
  const files: File[] = [];
  for (const child of directory.list()) {
    // Check the returned path as well as the parent before ever considering it for deletion.
    if (!child.uri.startsWith(root.replace(/\/?$/, "/")))
      throw new Error("Unexpected storage path. No cleanup was completed.");
    if (child instanceof Directory) files.push(...files_in(child, root, depth + 1));
    else files.push(child);
  }
  return files;
}
function temporary_files() {
  return TEMP_FOLDERS.flatMap((name) => files_in(new Directory(Paths.cache, name)));
}
function clearable(file: File, now: number) {
  const modified = file.modificationTime;
  const created = file.creationTime;
  return (
    typeof modified === "number" &&
    Number.isFinite(modified) &&
    modified > 0 &&
    modified < now - TEMP_RETENTION_MS &&
    typeof created === "number" &&
    Number.isFinite(created) &&
    created > 0 &&
    created < now - TEMP_RETENTION_MS
  );
}
function file_bytes(file: File) {
  const size = file.size;
  if (!Number.isFinite(size) || size < 0) throw new Error("File size is unavailable.");
  return size;
}
export function read_temporary_usage(now = Date.now()): TemporaryUsage | null {
  if (Platform.OS === "web") return null;
  return temporary_files().reduce(
    (total, file) => {
      const bytes = file_bytes(file);
      return {
        bytes: total.bytes + bytes,
        clearableBytes: total.clearableBytes + (clearable(file, now) ? bytes : 0),
      };
    },
    { bytes: 0, clearableBytes: 0 },
  );
}

/** Rechecks age at deletion. Recent picker/camera/share files are left for their owning operation. */
export function clear_old_temporary_files(now = Date.now()) {
  if (Platform.OS === "web") return;
  const files = temporary_files();
  for (const file of files) if (file.exists && clearable(file, now)) file.delete();
}

export async function read_scan_photo_usage(uid: string): Promise<number | null> {
  if (Platform.OS === "web") return null;
  const owner = await digestStringAsync(CryptoDigestAlgorithm.SHA256, uid);
  return files_in(new Directory(Paths.document, "ScanDrafts", owner)).reduce(
    (n, file) => n + file_bytes(file),
    0,
  );
}
