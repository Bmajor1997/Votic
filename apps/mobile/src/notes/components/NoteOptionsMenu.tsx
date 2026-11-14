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
  on_close,
  on_edit,
  on_toggle_pin,
  on_open_in_reader,
  on_share,
  on_remove,
}: {
  item: NoteItem | null;
  on_close: () => void;
  on_edit: (item: NoteItem) => void;
  on_toggle_pin: (item: NoteItem) => void;
  on_open_in_reader: (item: NoteItem) => void;
  on_share: (item: NoteItem) => void;
  on_remove: (item: NoteItem) => void;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  function run(action: (item: NoteItem) => void) {
    if (!item) return;
    on_close();
    action(item);
  }
  return (
    <Modal
      visible={item !== null}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={on_close}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close note options"
        onPress={on_close}
        style={s.backdrop}
      >
        <View accessibilityViewIsModal style={[s.menu, { backgroundColor: theme.surface }]}>
          <Text style={[s.title, { color: theme.text }]}>Note options</Text>
          <MenuAction
            icon="create-outline"
            label={item?.passage.note.trim() ? "Edit note" : "Add a note"}
            on_press={() => run(on_edit)}
          />
          <MenuAction
            icon={item?.passage.pinned ? "pin" : "pin-outline"}
            label={item?.passage.pinned ? "Unpin note" : "Pin note"}
            on_press={() => run(on_toggle_pin)}
          />
          <MenuAction icon="book-outline" label="Open in Reader" on_press={() => run(on_open_in_reader)} />
          <MenuAction icon="share-outline" label="Share note" on_press={() => run(on_share)} />
          <MenuAction
            icon="trash-outline"
            label="Remove from Notes"
            destructive
            on_press={() => run(on_remove)}
          />
          <Pressable
            accessibilityRole="button"
            onPress={on_close}
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
  on_press,
  destructive = false,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  on_press: () => void;
  destructive?: boolean;
}) {
  const { theme } = useVoticTheme();
  const color = destructive ? "#DC2626" : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={on_press}
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
