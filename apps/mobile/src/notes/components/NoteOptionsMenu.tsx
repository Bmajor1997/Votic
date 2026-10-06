import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, typography } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { NoteItem } from "../notesList";

/** Actions for one note. Each action receives the note the menu was opened for. */
export function NoteOptionsMenu({
  item,
  onClose,
  onEdit,
  onTogglePin,
  onOpenInReader,
  onShare,
  onRemove,
}: {
  item: NoteItem | null;
  onClose: () => void;
  onEdit: (item: NoteItem) => void;
  onTogglePin: (item: NoteItem) => void;
  onOpenInReader: (item: NoteItem) => void;
  onShare: (item: NoteItem) => void;
  onRemove: (item: NoteItem) => void;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  function run(action: (item: NoteItem) => void) {
    if (!item) return;
    onClose();
    action(item);
  }
  return (
    <Modal
      visible={item !== null}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close note options"
        onPress={onClose}
        style={s.backdrop}
      >
        <View accessibilityViewIsModal style={[s.menu, { backgroundColor: theme.surface }]}>
          <Text style={[s.title, { color: theme.text }]}>Note options</Text>
          <MenuAction
            icon="create-outline"
            label={item?.passage.note.trim() ? "Edit note" : "Add a note"}
            onPress={() => run(onEdit)}
          />
          <MenuAction
            icon={item?.passage.pinned ? "pin" : "pin-outline"}
            label={item?.passage.pinned ? "Unpin note" : "Pin note"}
            onPress={() => run(onTogglePin)}
          />
          <MenuAction icon="book-outline" label="Open in Reader" onPress={() => run(onOpenInReader)} />
          <MenuAction icon="share-outline" label="Share note" onPress={() => run(onShare)} />
          <MenuAction
            icon="trash-outline"
            label="Remove from Notes"
            destructive
            onPress={() => run(onRemove)}
          />
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[s.cancel, { borderColor: theme.border }]}
          >
            <Text style={[s.cancelText, { color: theme.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function MenuAction({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { theme } = useVoticTheme();
  const color = destructive ? "#DC2626" : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.action, { backgroundColor: pressed ? theme.surfaceMuted : "transparent" }]}
    >
      <Ionicons name={icon} size={21} color={color} />
      <Text style={[s.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.3)", justifyContent: "flex-end", padding: spacing.md },
  menu: { borderRadius: radii.lg, padding: spacing.md, gap: 2 },
  title: { ...typography.sectionTitle, padding: spacing.sm },
  action: {
    minHeight: 52,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  actionText: { fontSize: 16, fontWeight: "700" },
  cancel: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  cancelText: { fontSize: 16, fontWeight: "700" },
});
