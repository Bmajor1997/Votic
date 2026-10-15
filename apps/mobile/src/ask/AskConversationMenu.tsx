import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";

export type AskConversationAction = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  /** Shown but not pressable, such as "Conversation saved to Notes" once it's done. */
  done?: boolean;
  disabled?: boolean;
};

const MENU_WIDTH = 264;

/**
 * The "⋯" button in the Ask Votic header. It holds what applies to the whole conversation (saving it,
 * summarizing it), so those choices don't sit under every answer.
 */
export function AskConversationMenu({ actions }: { actions: AskConversationAction[] }) {
  const { theme } = useVoticTheme();
  const { width, height } = useWindowDimensions();
  const button = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number; placed: boolean } | null>(null);
  if (!actions.length) return null;
  function open() {
    const node = button.current;
    // Open above a bottom-docked header when the menu would fall outside the screen.
    setAnchor({ top: 96, right: 16, placed: !node?.measureInWindow });
    node?.measureInWindow?.((x, y, w, h) =>
      setAnchor((current) =>
        current
          ? {
              top: Math.max(
                8,
                y + h + 4 + actions.length * 48 > height - 24 ? y - actions.length * 48 - 4 : y + h + 4,
              ),
              right: Math.max(8, width - (x + w)),
              placed: true,
            }
          : current,
      ),
    );
  }
  const close = () => setAnchor(null);
  return (
    <>
      <Pressable
        ref={button}
        accessibilityRole="button"
        accessibilityLabel="Conversation options"
        accessibilityState={{ expanded: Boolean(anchor) }}
        onPress={open}
        style={({ pressed }) => [s.button, { opacity: pressed ? 0.55 : 1 }]}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
      </Pressable>
      <Modal visible={Boolean(anchor)} transparent animationType="fade" onRequestClose={close}>
        <Pressable accessibilityLabel="Close conversation options" style={s.backdrop} onPress={close} />
        {anchor ? (
          <View
            accessibilityRole="menu"
            style={[
              s.menu,
              {
                top: anchor.top,
                right: anchor.right,
                opacity: anchor.placed ? 1 : 0,
                width: Math.min(MENU_WIDTH, width - 16),
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            {actions.map((action, index) => (
              <Pressable
                key={action.label}
                accessibilityRole="menuitem"
                accessibilityLabel={action.label}
                accessibilityState={{ disabled: Boolean(action.done || action.disabled) }}
                disabled={action.done || action.disabled}
                onPress={() => {
                  close();
                  action.onPress();
                }}
                style={({ pressed }) => [
                  s.item,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                  { backgroundColor: pressed ? theme.surfaceMuted : "transparent" },
                ]}
              >
                <Ionicons
                  name={action.done ? "checkmark-circle" : action.icon}
                  size={19}
                  color={action.done ? theme.mutedText : theme.text}
                />
                <Text style={[s.itemText, { color: action.done ? theme.mutedText : theme.text }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  menu: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#071A38",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  item: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  itemText: { flexShrink: 1, fontSize: 15, fontWeight: "600" },
});
