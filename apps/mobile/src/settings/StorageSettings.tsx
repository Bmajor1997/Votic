import { useFocusEffect, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "../components/Card";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { useAccountData } from "../storage/AccountDataProvider";
import {
  AccountStorageUsage,
  format_storage_bytes,
  read_account_storage_usage,
} from "../storage/storageUsage";
import {
  clear_old_temporary_files,
  read_scan_photo_usage,
  read_temporary_usage,
  TemporaryUsage,
} from "../storage/storageUsageFiles";
import { useVoticTheme } from "../theme/ThemeProvider";
import { SettingsGroup, SettingsRow } from "./SettingsNavigation";

type Usage = { account: AccountStorageUsage; photos: number | null; temporary: TemporaryUsage | null };
export function StorageSettings() {
  const { uid } = useAccountData();
  const library = useDocumentLibrary();
  const ready = library.loaded;
  const { theme } = useVoticTheme();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0);
  const focused = useRef(false);
  const pending = useRef<number | null>(null);
  const flush = useRef(library.flush);
  useEffect(() => {
    flush.current = library.flush;
  }, [library.flush]);
  const refresh = useCallback(
    async (cleanup = false) => {
      if (!uid || !focused.current || pending.current === generation.current) return;
      const current = generation.current;
      pending.current = current;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await flush.current();
        if (current !== generation.current) return;
        if (cleanup) clear_old_temporary_files();
        const [account, photos] = await Promise.all([
          read_account_storage_usage(uid),
          read_scan_photo_usage(uid).catch(() => null),
        ]);
        let temporary: TemporaryUsage | null = null;
        try {
          temporary = read_temporary_usage();
        } catch {
          /* An unavailable measurement is never shown as zero. */
        }
        if (current !== generation.current) return;
        setUsage({ account, photos, temporary });
        if (cleanup)
          setNotice("Old temporary files cleared. Saved documents, notes, and unfinished scans were kept.");
      } catch (failure) {
        if (current === generation.current) {
          setUsage(null);
          setError(failure instanceof Error ? failure.message : "Could not read storage. Please try again.");
        }
      } finally {
        if (pending.current === current) pending.current = null;
        if (current === generation.current) setBusy(false);
      }
    },
    [uid],
  );
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (ready) void refresh();
      return () => {
        focused.current = false;
        generation.current++;
      };
    }, [refresh, ready]),
  );
  const bytes = (value: number | null | undefined) =>
    value == null ? "Unavailable" : format_storage_bytes(value);
  const row = (label: string, value: number | null | undefined) => (
    <View style={s.summaryRow}>
      <Text style={[s.body, { color: theme.text, flex: 1 }]}>{label}</Text>
      <Text style={[s.body, { color: theme.text }]}>{bytes(value)}</Text>
    </View>
  );
  return (
    <>
      <Text style={[s.body, { color: theme.mutedText }]}>
        Documents and notes use storage on this device. These estimates do not include the installed app,
        database overhead, other accounts, or copies you saved outside Votic. Temporary files are shared by
        Votic on this device.
      </Text>
      {busy ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.mutedText }}>
          Measuring storage…
        </Text>
      ) : null}
      {!uid ? <Text style={{ color: theme.text }}>Sign in to view your library storage.</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.text }}>
          {error}
        </Text>
      ) : null}
      {usage ? (
        <>
          <Card>
            {row("Saved account data", usage.account.bytes)}
            {row("Unfinished scan photos", usage.photos)}
            {row("Temporary files", usage.temporary?.bytes)}
            {row("Safe to clear now", usage.temporary?.clearableBytes)}
          </Card>
          <Text style={[s.heading, { color: theme.text }]}>Largest saved documents</Text>
          <Text style={[s.body, { color: theme.mutedText }]}>
            Estimated readable text and metadata, including notes. Original imported file sizes can differ.
            Recently Deleted items still use space until permanently deleted or expired.
          </Text>
          <Card>
            {usage.account.documents.slice(0, 10).map((document) => (
              <View key={document.id} style={s.summaryRow}>
                <Text style={[s.body, { color: theme.text, flex: 1 }]}>
                  {document.title}
                  {document.deleted ? " (Recently Deleted)" : ""}
                </Text>
                <Text style={[s.body, { color: theme.mutedText }]}>{bytes(document.bytes)}</Text>
              </View>
            ))}
            {!usage.account.documents.length ? (
              <Text style={{ color: theme.mutedText }}>No saved documents yet.</Text>
            ) : null}
          </Card>
        </>
      ) : null}
      {uid ? <StorageButton label="Refresh storage" disabled={busy} onPress={() => void refresh()} /> : null}
      <StorageButton
        label="Clear old temporary files"
        disabled={busy || !uid || !usage?.temporary?.clearableBytes || Platform.OS === "web"}
        onPress={() =>
          Alert.alert(
            "Clear old temporary files?",
            "Remove Votic's temporary import and export files older than one hour. Saved documents, notes, unfinished scan reviews, and backups saved outside Votic will be kept.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Clear temporary files", onPress: () => void refresh(true) },
            ],
          )
        }
      />
      <Text style={[s.body, { color: theme.mutedText }]}>
        Recent temporary files are kept for one hour so imports and sharing can finish. Unfinished scan photos
        are saved work and are not cleared here.
      </Text>
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.text }}>
          {notice}
        </Text>
      ) : null}
      <SettingsGroup>
        <SettingsRow
          label="Manage documents"
          detail="Review your library before choosing what to remove."
          hint="Opens your document library"
          icon="documents-outline"
          onPress={() => router.push("/(tabs)/documents")}
        />
        <SettingsRow
          separated
          label="Recently Deleted"
          detail="Restore items or choose what to permanently delete."
          hint="Opens Recently Deleted"
          icon="trash-outline"
          onPress={() => router.push("/recently-deleted")}
        />
      </SettingsGroup>
    </>
  );
}
function StorageButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, { borderColor: theme.border, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color: theme.accentText, fontSize: 16, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 23 },
  heading: { fontSize: 20, fontWeight: "700" },
  summaryRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  button: {
    minHeight: 52,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
