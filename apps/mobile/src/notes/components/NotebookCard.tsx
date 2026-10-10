import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { documentTypeColor } from "../../components/DocumentTypeIcon";
import { readableTitle } from "../../documents/documentDisplay";
import { VoticDocument } from "../../documents/types";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { dateLabel } from "../notesList";

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
  const color = documentTypeColor(document.sourceName);
  const latest = Math.max(document.importedAt, ...entries.map((entry) => entry.updatedAt));
  const counts = entries.length
    ? `${notes} ${notes === 1 ? "note" : "notes"} · ${passages} ${passages === 1 ? "passage" : "passages"}`
    : "No notes yet";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${document.title} notebook`}
      accessibilityHint={`${counts}. Opens this document’s notes.`}
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
          <Ionicons
            name={document.notebookKind === "quick-notes" ? "create-outline" : "book-outline"}
            size={28}
            color={theme.accentText}
          />
        </View>
        <Text style={[s.label, { color: theme.accentText }]}>
          {document.notebookKind === "quick-notes" ? "PERSONAL" : "DOCUMENT"}
        </Text>
        <View style={[s.rule, { backgroundColor: theme.border }]} />
        <View style={[s.rule, { backgroundColor: theme.border, width: "40%" }]} />
      </View>
      <View style={s.copy}>
        <Text numberOfLines={3} style={[s.title, { color: theme.text }]}>
          {readableTitle(document.title)}
        </Text>
        <Text style={[s.counts, { color: theme.mutedText }]}>{counts}</Text>
        <View style={s.footer}>
          <Text style={[s.date, { color: theme.mutedText }]}>
            {entries.length ? dateLabel(latest) : "Ready for ideas"}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={theme.accentText} />
        </View>
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, overflow: "hidden" },
  cover: { minHeight: 150, padding: 20, gap: 10 },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  rule: { height: 2, width: "65%", borderRadius: 2 },
  copy: { padding: 14, gap: 8, flex: 1 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: "800" },
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
