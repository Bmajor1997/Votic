import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FileTypeIcon } from "../components/FileTypeIcon";
import { mix, useVoticTheme } from "../theme/ThemeProvider";

/** The longest section name shown on the chip; the full name is still read by screen readers. */
const MAX_SECTION = 30;

/**
 * The line above an Ask Votic answer that says where it came from, shown once the answer has finished writing. A
 * document answer gets a soft, borderless oval with the file icon and a chevron, so it's clearly tappable: "From passage 1 · Job Description". Tapping it opens
 * that passage in the Reader. An answer that didn't rest on one passage (including "the document doesn't say") is
 * labelled "Searched this document", and a notice that didn't use the document at all is labelled "Votic help".
 */
export function AskAnswerSourceChip({
  kind,
  passage,
  section,
  documentTitle,
  filename,
  on_press,
}: {
  kind: "passage" | "document" | "help";
  passage?: number;
  section?: string | null;
  documentTitle: string;
  filename?: string;
  on_press?: () => void;
}) {
  const { theme } = useVoticTheme();
  if (kind !== "passage" || passage === undefined || !on_press) {
    const help = kind === "help";
    return (
      <View style={s.plain}>
        <Ionicons
          accessible={false}
          name={help ? "help-circle-outline" : "search-outline"}
          size={15}
          color={theme.mutedText}
        />
        <Text style={[s.plainText, { color: theme.mutedText }]}>
          {help ? "Votic help" : "Searched this document"}
        </Text>
      </View>
    );
  }
  const name = section?.trim() || documentTitle;
  const shown = name.length > MAX_SECTION ? `${name.slice(0, MAX_SECTION - 1).trimEnd()}…` : name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`From passage ${passage}, ${name}`}
      accessibilityHint="Opens this passage in the Reader"
      onPress={on_press}
      // The chip is drawn small, but the area you can tap stays at least 44 points tall.
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={({ pressed }) => [
        s.chip,
        { backgroundColor: mix(theme.linkText, theme.background, pressed ? 0.78 : 0.9) },
      ]}
    >
      <FileTypeIcon filename={filename} size={15} decorative />
      <Text numberOfLines={1} style={[s.chipText, { color: theme.linkText }]}>
        From passage {passage}
        <Text style={s.chipSection}> · {shown}</Text>
      </Text>
      <Ionicons accessible={false} name="chevron-forward" size={13} color={theme.linkText} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  plain: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 24 },
  plainText: { fontSize: 12, fontWeight: "600" },
  // A soft oval: fully rounded ends, no outline, a little more room on each side than above and below.
  chip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: "700" },
  chipSection: { fontWeight: "500", opacity: 0.85 },
});
