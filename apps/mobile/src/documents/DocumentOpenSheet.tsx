import { DocumentCover } from "../components/DocumentCover";
import { editorial } from "../design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii, spacing } from "../design/tokens";
import { sheetStyles } from "../reader/components/sheetStyles";
import { useVoticTheme } from "../theme/ThemeProvider";
import { file_type_label, progress_label, readable_title } from "./documentDisplay";
import { VoticDocument } from "./types";

/** Choose the controls before opening a document, without starting narration unexpectedly. */
export function DocumentOpenSheet({
  document,
  onClose,
  onOpen,
}: {
  document: VoticDocument | null;
  onClose: () => void;
  onOpen: (document: VoticDocument, mode: "read" | "listen") => void;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={document !== null}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel opening document"
        onPress={onClose}
        style={sheetStyles.modalBackdrop}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={[
            sheetStyles.sheet,
            { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, spacing.xl) },
          ]}
        >
          <View style={[sheetStyles.handle, { backgroundColor: theme.border }]} />
          {document ? (
            <ScrollView contentContainerStyle={s.content}>
              <View style={s.identity}>
                <DocumentCover document={document} size="lg" />
                <View style={s.copyColumn}>
                  <Text accessibilityRole="header" style={[s.documentTitle, { color: theme.text }]}>
                    {readable_title(document.title)}
                  </Text>
                  <Text style={[s.copy, { color: theme.mutedText }]}>
                    {file_type_label(document.sourceName)} · {progress_label(document)}
                  </Text>
                </View>
              </View>
              <Text style={[s.copy, { color: theme.mutedText }]}>
                How would you like to open this document?
              </Text>
              {(["read", "listen"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  accessibilityLabel={mode === "read" ? "Read" : "Listen"}
                  accessibilityHint={
                    mode === "read"
                      ? "Opens the document for reading at your saved position"
                      : "Starts listening at your saved position."
                  }
                  onPress={() => onOpen(document, mode)}
                  style={({ pressed }) => [
                    s.choice,
                    {
                      borderColor: theme.border,
                      backgroundColor: pressed ? theme.brandTint : theme.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={mode === "read" ? "book-outline" : "headset-outline"}
                    size={24}
                    color={theme.accentText}
                  />
                  <View style={s.copyColumn}>
                    <Text style={[s.label, { color: theme.text }]}>
                      {mode === "read" ? "Read" : "Listen"}
                    </Text>
                    <Text style={[s.copy, { color: theme.mutedText }]}>
                      {mode === "read" ? "Read at your own pace." : "Hear your document read aloud."}
                    </Text>
                  </View>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={onClose} style={s.cancel}>
                <Text style={[s.label, { color: theme.accentText }]}>Cancel</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const s = StyleSheet.create({
  content: { gap: spacing.lg },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingVertical: spacing.sm },
  documentTitle: { ...editorial, fontSize: 26, lineHeight: 34 },
  choice: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  copyColumn: { flex: 1, gap: spacing.xs },
  copy: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 17, lineHeight: 24, fontWeight: "700" },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center" },
});
