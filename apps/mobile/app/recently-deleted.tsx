import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../src/components/BackHeader";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";

export default function RecentlyDeletedScreen() {
  const { recovery, flush, persistenceError } = useDocumentLibrary();
  const [error, setError] = useState<string | null>(null);
  const { theme } = useVoticTheme();
  const items = [
    ...recovery.documents.map((d) => ({
      documentId: d.id,
      passageId: undefined as string | undefined,
      title: d.title,
      at: d.deletedAt!,
      detail: "Document and associated notes",
    })),
    ...recovery.notes.map(({ document, passage }) => ({
      documentId: document.id,
      passageId: passage.id,
      title: passage.title || passage.note || passage.text,
      at: passage.deletedAt!,
      detail: `Note in ${document.title}`,
    })),
  ].sort((a, b) => b.at - a.at);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <BackHeader title="Recently Deleted" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <Text style={{ color: theme.mutedText }}>
          Restore items for 30 days. Deleting a document also hides its notes. Items still use device storage
          and are included in library backups until permanently deleted or expired. Older exported backups
          keep their own copies.
        </Text>
        {error || recovery.error || persistenceError ? (
          <Text accessibilityRole="alert" style={{ color: theme.text }}>
            {error || recovery.error || persistenceError}
          </Text>
        ) : null}
        {!items.length ? <Text style={{ color: theme.text }}>No recently deleted items</Text> : null}
        {items.map((item) => (
          <View
            key={JSON.stringify([item.documentId, item.passageId || null])}
            style={{ padding: 16, gap: 8, backgroundColor: theme.surface, borderRadius: 16 }}
          >
            <Text numberOfLines={3} style={{ color: theme.text, fontSize: 18 }}>
              {item.title}
            </Text>
            <Text style={{ color: theme.mutedText }}>
              {item.detail} · Deleted {new Date(item.at).toLocaleDateString()}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Restore ${item.title}`}
              style={{ minHeight: 48, justifyContent: "center" }}
              onPress={() => {
                recovery.restore(item.documentId, item.passageId);
                void flush().catch(() =>
                  setError("Restore could not be saved. Keep Votic open and try again."),
                );
              }}
            >
              <Text style={{ color: theme.accentText }}>Restore</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: "center" }}
              onPress={() =>
                Alert.alert(
                  "Delete permanently?",
                  "This device copy cannot be recovered. Exported backups are not changed.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete permanently",
                      style: "destructive",
                      onPress: () =>
                        void recovery
                          .permanentlyDelete(item.documentId, item.passageId)
                          .then(flush)
                          .catch(() =>
                            setError(
                              "Permanent deletion could not be confirmed. Keep Votic open, free device storage, and retry.",
                            ),
                          ),
                    },
                  ],
                )
              }
            >
              <Text style={{ color: theme.text }}>Delete permanently</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
