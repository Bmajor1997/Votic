import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DocumentTypeIcon, documentTypeColor } from "../../components/DocumentTypeIcon";
import { controlSizes, radii, spacing } from "../../design/tokens";
import { SavedPassage, VoticDocument } from "../../documents/types";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { noteSelectionId } from "../askVoticNotesContext";
import { automaticNoteTitle, noteTypeLabel } from "../noteMetadata";
import { dateLabel, NoteItem } from "../notesList";

/** One document's notes and saved passages in the Notes list. */
export function NoteGroupCard({
  document,
  passages,
  inNotebook,
  selecting,
  selectedIds,
  onOpenNotebook,
  onToggleSelected,
  onView,
  onMore,
}: {
  document: VoticDocument;
  passages: SavedPassage[];
  inNotebook: boolean;
  selecting: boolean;
  /** Selection keys from noteSelectionId. */
  selectedIds: string[];
  onOpenNotebook: () => void;
  onToggleSelected: (selectionId: string) => void;
  onView: (item: NoteItem) => void;
  onMore: (item: NoteItem) => void;
}) {
  const { theme } = useVoticTheme();
  const color = documentTypeColor(document.sourceName);
  const noteCount = passages.filter((passage) => passage.note.trim()).length;
  const savedCount = passages.length - noteCount;
  return (
    <View style={[s.group, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${document.title} notebook`}
        onPress={onOpenNotebook}
        style={({ pressed }) => [s.header, { backgroundColor: pressed ? theme.surfaceMuted : "transparent" }]}
      >
        <DocumentTypeIcon sourceName={document.sourceName} size={40} />
        <View style={s.headerCopy}>
          <Text numberOfLines={1} style={[s.documentTitle, { color: theme.text }]}>
            {document.title}
          </Text>
          <Text style={[s.counts, { color: theme.mutedText }]}>
            {noteCount} {noteCount === 1 ? "note" : "notes"} · {savedCount}{" "}
            {savedCount === 1 ? "passage" : "passages"}
          </Text>
        </View>
        {inNotebook ? (
          <Ionicons name="book-outline" size={20} color={theme.accent} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
        )}
      </Pressable>
      {passages.map((passage) => {
        const selectionId = noteSelectionId(document.id, passage.id);
        const selected = selectedIds.includes(selectionId);
        const hasNote = Boolean(passage.note.trim());
        return (
          <View key={passage.id} style={[s.row, { borderTopColor: theme.border }]}>
            <View style={[s.accent, { backgroundColor: hasNote ? "#F59E0B" : color }]} />
            {selecting ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${selected ? "Deselect" : "Select"} note from ${document.title}`}
                onPress={() => onToggleSelected(selectionId)}
                style={s.selectionBox}
              >
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={23}
                  color={selected ? theme.accent : theme.mutedText}
                />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View note from ${document.title}`}
              onPress={() => (selecting ? onToggleSelected(selectionId) : onView({ document, passage }))}
              style={({ pressed }) => [s.main, { opacity: pressed ? 0.68 : 1 }]}
            >
              <Text style={[s.meta, { color: theme.mutedText }]}>
                {hasNote ? noteTypeLabel(passage.noteType) : "Saved passage"} · {dateLabel(passage.updatedAt)}
                {passage.pinned ? " · Pinned" : ""}
              </Text>
              {hasNote ? (
                <View style={s.titleRow}>
                  <Text numberOfLines={1} style={[s.title, { color: theme.text }]}>
                    {automaticNoteTitle(passage)}
                  </Text>
                  {passage.tags?.includes("votic") ? (
                    <View style={[s.voticBadge, { backgroundColor: theme.sentenceHighlight }]}>
                      <Ionicons name="sparkles" size={12} color={theme.accent} />
                      <Text style={[s.voticBadgeText, { color: theme.accent }]}>Votic</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text numberOfLines={3} style={[s.text, { color: theme.text }]}>
                {passage.note.trim() || passage.text}
              </Text>
              {passage.tags?.length ? (
                <Text numberOfLines={1} style={[s.tags, { color: theme.accent }]}>
                  {passage.tags.map((tag) => `#${tag}`).join("  ")}
                </Text>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`More options for ${hasNote ? "note" : "saved passage"}`}
              onPress={() => onMore({ document, passage })}
              style={s.more}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.mutedText} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: radii.lg, overflow: "hidden" },
  header: {
    minHeight: 66,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerCopy: { flex: 1 },
  documentTitle: { fontSize: 15, fontWeight: "800" },
  counts: { fontSize: 12, marginTop: 3 },
  row: {
    minHeight: 94,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
  },
  accent: { width: 3, borderRadius: 2, marginVertical: 3, marginRight: spacing.sm },
  selectionBox: { width: 36, alignItems: "center", justifyContent: "center" },
  main: { flex: 1, justifyContent: "center", gap: 5 },
  meta: { fontSize: 12, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { fontSize: 15, fontWeight: "800", flexShrink: 1 },
  voticBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  voticBadgeText: { fontSize: 10, fontWeight: "800" },
  text: { fontSize: 14, lineHeight: 20 },
  tags: { fontSize: 12, fontWeight: "700" },
  more: {
    width: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
});
