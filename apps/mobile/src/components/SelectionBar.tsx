import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";

export type SelectionNoun = { one: string; many: string };

/** "1 note", "3 notes". */
export function count_label(count: number, noun: SelectionNoun) {
  return `${count} ${count === 1 ? noun.one : noun.many}`;
}

/**
 * The bar shown while choosing items in a list: how many are chosen, Select all (or Deselect all), any screen-specific
 * actions passed as children, Delete, and Cancel. One, several or every item can be chosen; Delete asks first.
 */
export function SelectionBar({
  count,
  total,
  noun,
  prompt,
  onToggleAll,
  onDelete,
  onCancel,
  children,
}: PropsWithChildren<{
  count: number;
  /** How many items can be chosen right now (what the list is showing). */
  total: number;
  noun: SelectionNoun;
  /** Shown while nothing is chosen, e.g. "Choose notes to ask about, share, or delete". */
  prompt: string;
  onToggleAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
}>) {
  const { theme } = useVoticTheme();
  const destructive = theme.isDark ? "#FFB4B4" : "#B91C1C";
  const allChosen = total > 0 && count >= total;
  const pill = [s.pill, { borderColor: theme.border, backgroundColor: theme.surface }];
  return (
    <View style={[s.bar, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text accessibilityLiveRegion="polite" style={[s.count, { color: theme.text }]}>
        {count ? `${count_label(count, noun)} selected` : prompt}
      </Text>
      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            allChosen ? `Deselect all ${noun.many}` : `Select all ${count_label(total, noun)}`
          }
          disabled={!total}
          accessibilityState={{ disabled: !total }}
          onPress={onToggleAll}
          style={({ pressed }) => [...pill, { opacity: !total ? 0.45 : pressed ? 0.7 : 1 }]}
        >
          <Ionicons
            name={allChosen ? "remove-circle-outline" : "checkmark-done-outline"}
            size={17}
            color={theme.text}
          />
          <Text style={[s.pillText, { color: theme.text }]}>{allChosen ? "Deselect all" : "Select all"}</Text>
        </Pressable>
        {count ? children : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={count ? `Delete ${count_label(count, noun)}` : `Delete selected ${noun.many}`}
          accessibilityHint={
            count ? "Asks before moving them to Recently Deleted" : `Choose ${noun.many} first`
          }
          disabled={!count}
          accessibilityState={{ disabled: !count }}
          onPress={onDelete}
          style={({ pressed }) => [
            ...pill,
            { borderColor: count ? destructive : theme.border, opacity: !count ? 0.45 : pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="trash-outline" size={17} color={count ? destructive : theme.mutedText} />
          <Text style={[s.pillText, { color: count ? destructive : theme.mutedText }]}>Delete</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cancel ${noun.one} selection`}
          onPress={onCancel}
          style={({ pressed }) => [...pill, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[s.pillText, { color: theme.mutedText }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, gap: spacing.sm },
  count: { fontSize: 14, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  pill: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pillText: { fontSize: 13, fontWeight: "800" },
});
