import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FileTypeIcon } from "../components/FileTypeIcon";
import { mix, useVoticTheme } from "../theme/ThemeProvider";

/** The longest section name shown on the chip; the full name is still read by screen readers. */
const MAX_SECTION = 40;

/**
 * The line above an Ask Votic answer that says where it came from. A document answer gets a tinted, bordered chip
 * with the file icon and a chevron, so it's clearly tappable: "From passage 1 · Job Description". Tapping it opens
 * that passage in the Reader. Answers that didn't come from a passage get a plain label instead.
 */
export function AskAnswerSourceChip({
  kind,
  passage,
  section,
  documentTitle,
  filename,
  onPress,
}: {
  kind: "passage" | "document" | "help";
  passage?: number;
  section?: string | null;
  documentTitle: string;
  filename?: string;
  onPress?: () => void;
}) {
  const { theme } = useVoticTheme();
  if (kind !== "passage" || passage === undefined || !onPress) {
    const help = kind === "help";
    return (
      <View style={s.plain}>
        <Ionicons
          accessible={false}
          name={help ? "help-circle-outline" : "document-text-outline"}
          size={15}
          color={theme.mutedText}
        />
        <Text style={[s.plainText, { color: theme.mutedText }]}>
          {help ? "Votic help" : "From this document"}
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
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        {
          borderColor: theme.linkText,
          backgroundColor: mix(theme.linkText, theme.background, pressed ? 0.75 : 0.9),
        },
      ]}
    >
      <FileTypeIcon filename={filename} size={20} decorative />
      <Text numberOfLines={1} style={[s.chipText, { color: theme.linkText }]}>
        From passage {passage}
        <Text style={s.chipSection}> · {shown}</Text>
      </Text>
      <Ionicons accessible={false} name="chevron-forward" size={16} color={theme.linkText} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  plain: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 24 },
  plainText: { fontSize: 12, fontWeight: "600" },
  chip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    paddingLeft: 10,
    paddingRight: 8,
    borderWidth: 1.5,
    borderRadius: 22,
  },
  chipText: { flexShrink: 1, fontSize: 14, fontWeight: "800" },
  chipSection: { fontWeight: "600" },
});
