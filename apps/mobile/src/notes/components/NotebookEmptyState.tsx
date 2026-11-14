import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "../../design/tokens";
import { VoticDocument } from "../../documents/types";
import { SecondaryButton } from "../../onboarding/components";
import { useVoticTheme } from "../../theme/ThemeProvider";

/**
 * Inside a notebook that has no notes yet: says so about this notebook, and offers the way to start one, instead
 * of the whole-app "Your notes will appear here" welcome.
 */
export function NotebookEmptyState({
  notebook,
  on_open_document,
}: {
  notebook: Pick<VoticDocument, "title" | "notebookKind">;
  on_open_document: () => void;
}) {
  const { theme } = useVoticTheme();
  const quickNotes = notebook.notebookKind === "quick-notes";
  return (
    <View style={s.empty}>
      <Ionicons name="create-outline" size={32} color={theme.mutedText} accessible={false} />
      <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
        No notes in this notebook yet
      </Text>
      <Text style={[s.copy, { color: theme.mutedText }]}>
        {quickNotes
          ? "Tap Quick Note to write one."
          : `Open ${notebook.title}, then save a passage or add a note while reading. Or tap Quick Note.`}
      </Text>
      {quickNotes ? null : (
        <SecondaryButton
          label="Open document"
          icon={<Ionicons name="book-outline" size={18} color={theme.text} accessible={false} />}
          on_press={on_open_document}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  title: { ...typography.sectionTitle, textAlign: "center" },
  copy: { fontSize: 16, lineHeight: 24, textAlign: "center" },
});
