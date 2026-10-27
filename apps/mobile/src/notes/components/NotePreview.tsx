import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SavedPassage, VoticDocument } from "../../documents/types";
import { note_palette } from "../notePalette";
import { editorial } from "../../design/editorial";
import { note_type_label } from "../noteMetadata";

const icons = {
  note: "create-outline",
  "key-point": "bulb-outline",
  question: "help-circle-outline",
  definition: "book-outline",
} as const;
/** A shared note sheet: source-colored type tab, actual note content in the foreground. */
export function NotePreview({
  passage,
  document,
  decorative = false,
}: {
  passage?: SavedPassage;
  document: VoticDocument;
  decorative?: boolean;
}) {
  const colors = note_palette(document);
  const { fontScale } = useWindowDimensions();
  const { label, heading, body, quote, icon, pinned } = preview_content(passage);
  return (
    <View
      testID="note-content-preview"
      accessible={false}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      style={[s.sheet, { borderColor: colors.border, backgroundColor: colors.paper }]}
    >
      <View testID="note-preview-type" style={[s.tab, { backgroundColor: colors.surface }]}>
        <Ionicons name={icon} size={16} color={colors.ink} />
        <Text style={[s.type, { color: colors.ink }]}>{label.toUpperCase()}</Text>
        {pinned ? <Ionicons name="pin" size={13} color={colors.strong} /> : null}
      </View>
      <View style={s.copy}>
        {heading ? (
          <Text numberOfLines={fontScale > 1.2 ? undefined : 2} style={[s.heading, { color: colors.ink }]}>
            {heading}
          </Text>
        ) : null}
        {body && body !== heading ? (
          <Text numberOfLines={fontScale > 1.2 ? undefined : 5} style={[s.body, { color: colors.detail }]}>
            {body}
          </Text>
        ) : null}
        {quote ? (
          <Text
            numberOfLines={fontScale > 1.2 ? undefined : 3}
            style={[s.quote, { color: colors.detail, borderLeftColor: colors.border }]}
          >
            {quote}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
function preview_content(passage?: SavedPassage) {
  if (!passage)
    return {
      label: "Notebook",
      heading: "",
      body: "Save a passage or add a note to start this notebook.",
      quote: "",
      icon: icons.note,
      pinned: false,
    };
  const note = passage.note.trim();
  const text = passage.text.trim();
  return {
    label: note ? note_type_label(passage.noteType) : "Saved passage",
    heading: passage.title?.trim(),
    body: note || text,
    quote: note && text !== note ? text : "",
    icon: icons[passage.noteType || "note"],
    pinned: passage.pinned,
  };
}

const s = StyleSheet.create({
  sheet: {
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  tab: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  type: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
    flex: 1,
  },
  copy: { padding: 14, gap: 8 },
  heading: { ...editorial, fontSize: 19, lineHeight: 25 },
  quote: {
    ...editorial,
    fontSize: 14,
    lineHeight: 21,
    borderLeftWidth: 2,
    paddingLeft: 8,
  },
  body: { fontSize: 15, lineHeight: 23 },
});
