import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, typography } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { dateLabel, NoteItem } from "../notesList";
import { notesSheetStyles as sheet } from "./notesSheetStyles";

/** Shows one note (or saved passage) with ways to ask about it or return to it in the Reader. */
export function NoteViewer({
  item,
  onClose,
  onAsk,
  onOpenInReader,
}: {
  item: NoteItem | null;
  onClose: () => void;
  onAsk: (item: NoteItem) => void;
  onOpenInReader: (item: NoteItem) => void;
}) {
  const { theme } = useVoticTheme();
  const hasNote = Boolean(item?.passage.note.trim());
  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sheet.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close note"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={[sheet.editor, { backgroundColor: theme.surface }]}>
          <View style={[sheet.handle, { backgroundColor: theme.border }]} />
          <View style={sheet.editorHeader}>
            <View style={sheet.editorCopy}>
              <Text style={[sheet.editorTitle, { color: theme.text }]}>
                {hasNote ? "Note" : "Saved passage"}
              </Text>
              <Text numberOfLines={1} style={[sheet.editorDocument, { color: theme.mutedText }]}>
                {item?.document.title} · {item ? dateLabel(item.passage.updatedAt) : ""}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close note"
              onPress={onClose}
              style={sheet.close}
            >
              <Ionicons name="close" size={23} color={theme.text} />
            </Pressable>
          </View>
          <View style={[s.source, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[s.label, { color: theme.accent }]}>{hasNote ? "YOUR NOTE" : "SAVED PASSAGE"}</Text>
            {hasNote ? (
              <Text style={[s.note, { color: theme.text }]}>{item?.passage.note}</Text>
            ) : (
              <Text style={[s.passage, { color: theme.text }]}>{item?.passage.text}</Text>
            )}
          </View>
          {item && hasNote ? (
            <ViewerAction
              icon="chatbubble-ellipses-outline"
              label="Ask Votic about this note"
              onPress={() => onAsk(item)}
            />
          ) : null}
          <ViewerAction
            icon="book-outline"
            label="Open in Reader"
            accessibilityLabel="Open this passage in Reader"
            onPress={() => {
              if (item) onOpenInReader(item);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function ViewerAction({
  icon,
  label,
  accessibilityLabel = label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [s.action, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={19} color={theme.accent} />
      <Text style={[s.actionText, { color: theme.accent }]}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color={theme.accent} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  source: { borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  label: { ...typography.eyebrow, fontSize: 11 },
  note: { fontSize: 18, lineHeight: 27, fontWeight: "600" },
  passage: { fontSize: 15, lineHeight: 23 },
  action: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  actionText: { ...typography.control, flex: 1, textAlign: "center" },
});
