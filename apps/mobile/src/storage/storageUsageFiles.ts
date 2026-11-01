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
type Observation = { uri: string; modified: number; size: number; seen: number };
const observation_file = () => new File(Paths.cache, "VoticTemporaryAges.json");
function valid_observation(value: Observation, now: number) {
  return (
    typeof value?.uri === "string" &&
    Number.isFinite(value.modified) &&
    Number.isFinite(value.size) &&
    Number.isFinite(value.seen) &&
    value.seen > 0 &&
    value.seen <= now
  );
}
function save_observations(entries: Observation[]) {
  const file = observation_file();
  file.create({ overwrite: true });
  file.write(JSON.stringify(entries));
}
/** Cache metadata contains only paths, sizes and times. Invalid/lost metadata starts a new safe waiting period. */
function observe_files(files: File[], now: number) {
  if (files.length > 10_000) throw new Error("Temporary folder could not be measured.");
  const metadata = observation_file();
  let prior: Observation[] = [];
  try {
    if (metadata.exists && metadata.size < 4_000_000) {
      const parsed: unknown = JSON.parse(metadata.textSync());
      if (Array.isArray(parsed)) prior = parsed.filter((value) => valid_observation(value, now));
    }
  } catch {
    /* Corrupted cache metadata never proves a file is old. */
  }
  const old = new Map(prior.map((entry) => [entry.uri, entry]));
  const next = files.map((file) => {
    const previous = old.get(file.uri);
    const same = previous?.modified === file.modificationTime && previous?.size === file.size;
    return {
      uri: file.uri,
      modified: file.modificationTime ?? 0,
      size: file.size,
      seen: same ? previous!.seen : now,
    };
  });
  save_observations(next); // If this fails, cleanup must not go ahead.
  return next;
}
function clearable(file: File, now: number, observations: Map<string, number>) {
  const modified = file.modificationTime;
  // Android can omit creation time. Old source mtimes alone cannot prove a fresh copy is old.
  // The conservative observation survives app restarts and resets if the file's size/mtime changes.
  const created = file.creationTime ?? observations.get(file.uri);
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
  const files = temporary_files();
  const observations = new Map(observe_files(files, now).map((entry) => [entry.uri, entry.seen]));
  return files.reduce(
    (total, file) => {
      const bytes = file_bytes(file);
      return {
        bytes: total.bytes + bytes,
        clearableBytes: total.clearableBytes + (clearable(file, now, observations) ? bytes : 0),
      };
    },
    { bytes: 0, clearableBytes: 0 },
  );
}

/** Rechecks age at deletion. Recent picker/camera/share files are left for their owning operation. */
export function clear_old_temporary_files(now = Date.now()) {
  if (Platform.OS === "web") return;
  const files = temporary_files();
  let entries = observe_files(files, now);
  const observations = new Map(entries.map((entry) => [entry.uri, entry.seen]));
  for (const file of files) {
    if (file.exists && clearable(file, now, observations)) {
      // Remove proof of age before deletion, so a new copy at the same path cannot inherit it.
      entries = entries.filter((entry) => entry.uri !== file.uri);
      save_observations(entries);
      file.delete();
    }
  }
}

export async function read_scan_photo_usage(uid: string): Promise<number | null> {
  if (Platform.OS === "web") return null;
  const owner = await digestStringAsync(CryptoDigestAlgorithm.SHA256, uid);
  return files_in(new Directory(Paths.document, "ScanDrafts", owner)).reduce(
    (n, file) => n + file_bytes(file),
    0,
  );
}
