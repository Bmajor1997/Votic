import { FileTypeIcon } from "../components/FileTypeIcon";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";
import { ReportAnswerButton } from "./ReportAnswerButton";

type Props = {
  /** Where the answer came from in a document. Opens the Reader at that passage. */
  source?: { filename?: string; label: string; accessibilityLabel: string; onPress: () => void } | null;
  /** Saving this one answer to Notes. Left out when the answer can't be saved (such as a limit notice). */
  save?: { saved: boolean; onPress: () => void; label?: string; savedLabel?: string } | null;
  listen?: { playing: boolean; failed: boolean; disabled?: boolean; onPress: () => void } | null;
  style?: StyleProp<ViewStyle>;
  reportText?: string;
};

/**
 * The quiet row under an Ask Votic answer: the source passage, read-aloud control, and bookmark.
 * Actions on the whole conversation live in the conversation menu instead, so they don't repeat under answers.
 */
export function AskAnswerFooter({ source, save, listen, style, reportText }: Props) {
  const { theme } = useVoticTheme();
  if (!source && !save && !listen && !reportText) return null;
  return (
    <View>
      <View style={[s.row, style]}>
        {source ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={source.accessibilityLabel}
            onPress={source.onPress}
            hitSlop={6}
            style={({ pressed }) => [s.source, { opacity: pressed ? 0.6 : 1 }]}
          >
            <FileTypeIcon filename={source.filename} size={24} decorative />
            <Text numberOfLines={1} style={[s.sourceText, { color: theme.linkText }]}>
              {source.label}
            </Text>
          </Pressable>
        ) : (
          <View style={s.spacer} />
        )}
        {listen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listen.playing ? "Stop reading answer" : "Read answer aloud"}
            accessibilityState={{ selected: listen.playing, disabled: Boolean(listen.disabled) }}
            disabled={listen.disabled}
            onPress={listen.onPress}
            style={({ pressed }) => [s.listen, { opacity: listen.disabled ? 0.4 : pressed ? 0.6 : 1 }]}
          >
            <Ionicons
              name={listen.playing ? "stop-circle-outline" : "volume-high-outline"}
              size={21}
              color={theme.accentText}
            />
          </Pressable>
        ) : null}
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
            {save.saved ? (
              <Text style={[s.savedText, { color: theme.mutedText }]}>Saved to Notes</Text>
            ) : null}
            <Ionicons
              name={save.saved ? "bookmark" : "bookmark-outline"}
              size={19}
              color={save.saved ? theme.linkText : theme.mutedText}
            />
          </Pressable>
        ) : null}
      </View>
      {reportText ? <ReportAnswerButton key={reportText} answer={reportText} /> : null}
      {listen?.failed ? (
        <Text accessibilityRole="alert" style={[s.savedText, { color: theme.text }]}>
          Couldn’t read this answer aloud. Tap the speaker to try again.
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  spacer: { flex: 1 },
  listen: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  source: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
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
