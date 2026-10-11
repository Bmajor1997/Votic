import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";

type Props = {
  /** Where the answer came from in a document. Opens the Reader at that passage. */
  source?: { label: string; accessibilityLabel: string; onPress: () => void } | null;
  /** Saving this one answer to Notes. Left out when the answer can't be saved (such as a limit notice). */
  save?: { saved: boolean; onPress: () => void; label?: string; savedLabel?: string } | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * The quiet row under an Ask Votic answer: the source passage on the left and a bookmark on the right.
 * Actions on the whole conversation live in the conversation menu instead, so they don't repeat under answers.
 */
export function AskAnswerFooter({ source, save, style }: Props) {
  const { theme } = useVoticTheme();
  if (!source && !save) return null;
  return (
    <View style={[s.row, style]}>
      {source ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={source.accessibilityLabel}
          onPress={source.onPress}
          hitSlop={6}
          style={({ pressed }) => [s.source, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="book-outline" size={14} color={theme.linkText} />
          <Text numberOfLines={1} style={[s.sourceText, { color: theme.linkText }]}>
            {source.label}
          </Text>
        </Pressable>
      ) : (
        <View style={s.spacer} />
      )}
      {save ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            save.saved ? (save.savedLabel ?? "Saved to Notes") : (save.label ?? "Save answer to Notes")
          }
          accessibilityState={{ disabled: save.saved, selected: save.saved }}
          disabled={save.saved}
          onPress={save.onPress}
          style={({ pressed }) => [s.save, { opacity: pressed ? 0.6 : 1 }]}
        >
          {save.saved ? <Text style={[s.savedText, { color: theme.mutedText }]}>Saved to Notes</Text> : null}
          <Ionicons
            name={save.saved ? "bookmark" : "bookmark-outline"}
            size={19}
            color={save.saved ? theme.linkText : theme.mutedText}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  spacer: { flex: 1 },
  source: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32 },
  sourceText: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  save: {
    minWidth: 44,
    minHeight: 44,
    marginVertical: -8,
    marginRight: -10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  savedText: { fontSize: 12, fontWeight: "600" },
});
