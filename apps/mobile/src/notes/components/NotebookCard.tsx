import { editorial } from "../../design/editorial";
import { FileTypeIcon } from "../../components/FileTypeIcon";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { document_type_color } from "../../components/DocumentTypeIcon";
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
  const color = document_type_color(document.sourceName);
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
        theme.elevation,
        {
          width: fullWidth ? "100%" : "48%",
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[s.cover, { backgroundColor: theme.brandTint }]}
      >
        <View style={[s.spine, { backgroundColor: color }]} />
        <View style={[s.icon, { backgroundColor: theme.surface }]}>
          {quick ? (
            <Ionicons name="create-outline" size={28} color={theme.accentText} />
          ) : (
            <FileTypeIcon filename={document.sourceName} decorative />
          )}
        </View>
        {/* The icon already shows the format; a generic "DOCUMENT" label would hide which document this is. */}
        {quick ? <Text style={[s.label, { color: theme.accentText }]}>PERSONAL</Text> : null}
        <View style={[s.rule, { backgroundColor: theme.border }]} />
        <View style={[s.rule, { backgroundColor: theme.border, width: "40%" }]} />
      </View>
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
  card: { borderWidth: 1, borderRadius: 24, overflow: "hidden" },
  filename: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  cover: { minHeight: 142, padding: 20, gap: 10 },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  rule: { height: 2, width: "65%", borderRadius: 2 },
  copy: { padding: 18, gap: 8, flex: 1 },
  title: { ...editorial, fontSize: 21, lineHeight: 28 },
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
