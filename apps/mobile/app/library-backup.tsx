import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View, Switch } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { SettingsPage } from "../src/settings/SettingsNavigation";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { useAccountData } from "../src/storage/AccountDataProvider";
import { create_library_backup, restore_library_backup } from "../src/storage/libraryBackup";
import { LibraryBackup, MAX_BACKUP_BYTES, parse_library_backup } from "../src/storage/libraryBackupModel";
import { remove_import_temp } from "../src/documents/importCache";

async function share_backup(raw: string) {
  const name = `Votic-library-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error("File sharing is unavailable on this device.");
  const folder = new Directory(Paths.cache, "LibraryBackups");
  if (folder.exists) folder.delete();
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, name);
  try {
    file.write(raw);
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      dialogTitle: "Save your Votic library backup",
      UTI: "public.json",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
export default function LibraryBackupScreen() {
  const { theme } = useVoticTheme();
  const account = useAccountData();
  const [incoming, setIncoming] = useState<LibraryBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [restorePreferences, setRestorePreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function export_library() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const backup = await account.runLibraryTask(create_library_backup);
      await share_backup(JSON.stringify(backup));
    } catch (error) {
      Alert.alert("Could not save backup", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function pick_backup() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setIncoming(null);
    let uri: string | undefined;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "application/octet-stream"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      uri = asset.uri;
      if (asset.size && asset.size > MAX_BACKUP_BYTES) throw new Error("Backup limit is 25 MB.");
      let raw: string;
      if (Platform.OS === "web") {
        if (!asset.file || asset.file.size > MAX_BACKUP_BYTES)
          throw new Error("Choose a backup file up to 25 MB.");
        raw = await asset.file.text();
      } else {
        const file = new File(asset.uri);
        if (!file.exists || file.size > MAX_BACKUP_BYTES)
          throw new Error("Choose a backup file up to 25 MB.");
        raw = await file.text();
      }
      setIncoming(parse_library_backup(raw));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not read this backup.");
    } finally {
      remove_import_temp(uri);
      setBusy(false);
    }
  }
  async function restore(backup: LibraryBackup) {
    setBusy(true);
    try {
      await account.runLibraryTask((uid) => restore_library_backup(uid, backup, { restorePreferences }));
      Alert.alert(
        "Library restored",
        "Existing work was kept. Differing documents were restored as copies. Restart Votic to apply any restored account preferences.",
      );
    } catch (error) {
      Alert.alert("Restore not finished", error instanceof Error ? error.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  function button(label: string, action: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={action}
        style={[s.button, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}
      >
        <Text style={s.buttonText}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <SettingsPage title="Library backup & restore">
      <Text style={[s.body, { color: theme.text }]}>
        Save your documents&apos; readable text, notes, collections, progress, activity, pronunciations, and
        account reading preferences. Original PDF, photo, and Office files are not included.
      </Text>
      <Text style={[s.body, { color: theme.mutedText }]}>
        Backups contain your private documents and notes and are not encrypted. Save them somewhere you trust.
        They contain no passwords, sign-in tokens, or purchases. Keep a backup outside this device; Votic does
        not sync your library automatically.
      </Text>
      {button("Save library backup", () => void export_library())}
      {button("Choose backup to restore", () => void pick_backup())}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.text }}>
          {error}
        </Text>
      ) : null}
      {incoming ? (
        <View style={s.preview}>
          <Text accessibilityRole="header" style={[s.heading, { color: theme.text }]}>
            Review backup
          </Text>
          <Text style={[s.body, { color: theme.text }]}>
            {incoming.documents.length} documents and notebooks ·{" "}
            {incoming.documents.reduce((n, d) => n + (d.savedPassages?.length ?? 0), 0)} notes and saved
            passages · {new Date(incoming.createdAt).toLocaleDateString()}
          </Text>
          <Text style={[s.body, { color: theme.mutedText }]}>
            Restore into this signed-in account. Existing work and preferences are kept; differing documents
            become copies. No account or membership will be changed. Reading preferences are replaced only if
            you choose below.
          </Text>
          <View style={{ gap: 8 }}>
            <Text style={[s.body, { color: theme.text }]}>Use reading preferences from this backup</Text>
            <Switch
              accessibilityLabel="Use reading preferences from this backup"
              value={restorePreferences}
              onValueChange={setRestorePreferences}
            />
          </View>
          {button("Restore this backup", () =>
            Alert.alert(
              "Restore library?",
              "This adds the reviewed backup to your current account. Keep Votic open until it finishes.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Restore", onPress: () => void restore(incoming) },
              ],
            ),
          )}
        </View>
      ) : null}
    </SettingsPage>
  );
}
const s = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 23 },
  heading: { fontSize: 20, fontWeight: "700" },
  button: { minHeight: 52, padding: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  preview: { gap: 16, paddingVertical: 12 },
});
