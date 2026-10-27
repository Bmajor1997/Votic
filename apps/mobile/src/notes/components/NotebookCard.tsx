import { NotePreview } from "./NotePreview";
import { editorial } from "../../design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { readable_title } from "../../documents/documentDisplay";
import { VoticDocument } from "../../documents/types";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { date_label } from "../notesList";

export function NotebookCard({
  document,
  fullWidth,
  onPress,
}: {
  document: VoticDocument;
  fullWidth: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  const entries = document.savedPassages || [];
  const notes = entries.filter((entry) => entry.note.trim()).length;
  const passages = entries.length - notes;
  const preview = [...entries].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const latest = Math.max(document.importedAt, ...entries.map((entry) => entry.updatedAt));
  const quick = document.notebookKind === "quick-notes";
  const title = readable_title(document.title);
  // The source file's own name, so notes from similarly titled documents stay distinguishable.
  const filename = quick ? null : document.sourceName.trim() || null;
  const counts = entries.length
    ? `${notes} ${notes === 1 ? "note" : "notes"} · ${passages} ${passages === 1 ? "passage" : "passages"}`
    : "No notes yet";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title} notebook`}
      accessibilityHint={`${filename ? `From ${filename}. ` : ""}${counts}. Opens this document’s notes.`}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        {
          width: fullWidth ? "100%" : "48%",
          backgroundColor: "transparent",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <NotePreview document={document} passage={preview} decorative />
      <View style={s.copy}>
        <Text numberOfLines={3} style={[s.title, { color: theme.text }]}>
          {title}
        </Text>
        {filename ? (
          <Text numberOfLines={1} ellipsizeMode="middle" style={[s.filename, { color: theme.mutedText }]}>
            {filename}
          </Text>
        ) : null}
        <Text style={[s.counts, { color: theme.mutedText }]}>{counts}</Text>
        <View style={s.footer}>
          <Text style={[s.date, { color: theme.mutedText }]}>
            {entries.length ? date_label(latest) : "Ready for ideas"}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={theme.accentText} />
        </View>
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: { gap: 8 },
  filename: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  copy: { gap: 5, flex: 1 },
  title: { ...editorial, fontSize: 19, lineHeight: 25 },
  counts: { fontSize: 12, lineHeight: 18 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    paddingTop: 6,
  },
  date: { fontSize: 12, flexShrink: 1 },
});
