import { router } from "expo-router";
import { Text } from "react-native";
import { useOcrReview } from "../documents/OcrReviewProvider";
import { useAccountData } from "../storage/AccountDataProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { SettingsGroup, SettingsRow } from "./SettingsNavigation";

export function LibraryToolsSettings() {
  const { uid } = useAccountData();
  const review = useOcrReview();
  const { theme } = useVoticTheme();
  return (
    <>
      <Text style={{ color: theme.mutedText, fontSize: 15, lineHeight: 23 }}>
        Your library is saved on this device. Export a backup to keep a copy elsewhere; Votic does not
        automatically sync your documents between devices.
      </Text>
      <SettingsGroup>
        {uid ? (
          <SettingsRow
            label="Library backup & restore"
            detail="Save a backup file or restore one you saved earlier."
            hint="Opens library backup and restore"
            icon="download-outline"
            onPress={() => router.push("/library-backup")}
          />
        ) : null}
        <SettingsRow
          separated={Boolean(uid)}
          label="Recently Deleted"
          detail="Restore deleted documents and notes for 30 days."
          hint="Opens Recently Deleted to restore or permanently delete items"
          icon="trash-outline"
          onPress={() => router.push("/recently-deleted")}
        />
        <SettingsRow
          separated
          label="Note drafts"
          detail="Continue an unfinished note."
          hint="Opens unfinished note drafts"
          icon="create-outline"
          onPress={() => router.push("/note-drafts")}
        />
        <SettingsRow
          separated
          label="Unfinished scan"
          detail="Resume recognized text and corrections."
          hint="Opens your saved scan review"
          icon="scan-outline"
          onPress={review.resume}
        />
      </SettingsGroup>
      {!uid ? <Text style={{ color: theme.mutedText }}>Sign in to back up your library.</Text> : null}
    </>
  );
}
