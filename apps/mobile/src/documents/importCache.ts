import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

/** Never delete a provider's original file or an arbitrary share URI. */
export function remove_import_temp(uri?: string) {
  if (!uri || Platform.OS === "web") return;
  const target = new URL(uri);
  const root = decodeURIComponent(new URL(Paths.cache.uri).pathname).replace(/\/?$/, "/");
  const path = decodeURIComponent(target.pathname);
  if (target.protocol !== "file:" || path.split("/").includes("..") || !path.startsWith(root)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
export function clear_import_cache() {
  if (Platform.OS === "web") return;
  // Directories owned by Expo's picker/camera, not the persistent library or provider originals.
  for (const name of ["DocumentPicker", "Camera"]) {
    const directory = new Directory(Paths.cache, name);
    if (directory.exists) directory.delete();
  }
}
