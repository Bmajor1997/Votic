import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SavedPassage } from "../../documents/types";
import { darkCards } from "../../design/cardPalette";
import { editorial } from "../../design/editorial";
import { note_type_label } from "../noteMetadata";

const icons = {
  note: "create-outline",
  "key-point": "bulb-outline",
  question: "help-circle-outline",
  definition: "book-outline",
} as const;
/** A shared note sheet: type in a lavender tab, actual note content in the foreground. */
export function NotePreview({
  passage,
  decorative = false,
}: {
  passage?: SavedPassage;
  decorative?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const { label, heading, body, quote, icon, pinned } = preview_content(passage);
  return (
    <View
      testID="note-content-preview"
      accessible={false}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      style={s.sheet}
    >
      <View testID="note-preview-type" style={s.tab}>
        <Ionicons name={icon} size={16} color={darkCards.notes.ink} />
        <Text style={s.type}>{label.toUpperCase()}</Text>
        {pinned ? <Ionicons name="pin" size={13} color={darkCards.notes.strong} /> : null}
      </View>
      <View style={s.copy}>
        {heading ? (
          <Text numberOfLines={fontScale > 1.2 ? undefined : 2} style={s.heading}>
            {heading}
          </Text>
        ) : null}
        {body && body !== heading ? (
          <Text numberOfLines={fontScale > 1.2 ? undefined : 5} style={s.body}>
            {body}
          </Text>
        ) : null}
        {quote ? (
          <Text numberOfLines={fontScale > 1.2 ? undefined : 3} style={s.quote}>
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
    borderColor: darkCards.notes.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F8F4FC",
  },
  tab: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: darkCards.notes.surface,
  },
  type: {
    color: darkCards.notes.ink,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
    flex: 1,
  },
  copy: { padding: 14, gap: 8 },
  heading: { ...editorial, color: darkCards.notes.ink, fontSize: 19, lineHeight: 25 },
  quote: {
    ...editorial,
    color: darkCards.notes.detail,
    fontSize: 14,
    lineHeight: 21,
    borderLeftWidth: 2,
    borderLeftColor: darkCards.notes.border,
    paddingLeft: 8,
  },
  body: { color: darkCards.notes.detail, fontSize: 15, lineHeight: 23 },
});
