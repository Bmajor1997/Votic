import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DocumentCover } from "../../components/DocumentCover";
import { documentTypeColor } from "../../components/DocumentTypeIcon";
import { readableTitle } from "../../documents/documentDisplay";
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
  previewLimit,
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
  /** Shows only the newest few, with a link to the full notebook. */
  previewLimit?: number;
}) {
  const { theme } = useVoticTheme();
  const color = documentTypeColor(document.sourceName);
  const noteCount = passages.filter((passage) => passage.note.trim()).length;
  const savedCount = passages.length - noteCount;
  const title = readableTitle(document.title);
  const shown = previewLimit ? passages.slice(0, previewLimit) : passages;
  const hidden = passages.length - shown.length;
  return (
    <View style={[s.group, theme.elevation, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      {!inNotebook ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${document.title} notebook`}
          accessibilityHint={`${noteCount} ${noteCount === 1 ? "note" : "notes"}, ${savedCount} saved ${savedCount === 1 ? "passage" : "passages"}`}
          onPress={onOpenNotebook}
          style={({ pressed }) => [
            s.header,
            { backgroundColor: pressed ? theme.surfaceMuted : theme.brandTint },
          ]}
        >
          <DocumentCover document={document} size="sm" />
          <View style={s.headerCopy}>
            <Text numberOfLines={2} style={[s.documentTitle, { color: theme.text }]}>
              {title} Notebook
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
      ) : null}
      {shown.map((passage) => {
        const selectionId = noteSelectionId(document.id, passage.id);
        const selected = selectedIds.includes(selectionId);
        const hasNote = Boolean(passage.note.trim());
        return (
          <View
            key={passage.id}
            style={[
              s.row,
              {
                borderTopColor: theme.border,
                backgroundColor: passage.tags?.includes("votic") ? theme.brandTint : theme.surface,
              },
            ]}
          >
            <View
              style={[
                s.accent,
                {
                  backgroundColor: passage.tags?.includes("votic")
                    ? theme.accent
                    : hasNote
                      ? "#B7791F"
                      : color,
                },
              ]}
            />
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
                      <Ionicons name="sparkles" size={12} color={theme.accentText} />
                      <Text style={[s.voticBadgeText, { color: theme.accentText }]}>Votic</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text numberOfLines={3} style={[s.text, { color: theme.text }]}>
                {passage.note.trim() || passage.text}
              </Text>
              {passage.tags?.length ? (
                <Text numberOfLines={1} style={[s.tags, { color: theme.accentText }]}>
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
      {hidden > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Show all ${passages.length} from ${title}`}
          onPress={onOpenNotebook}
          style={({ pressed }) => [
            s.showAll,
            { borderTopColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.brandTint },
          ]}
        >
          <Text style={[s.showAllText, { color: theme.accentText }]}>Show all {passages.length}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.accent} />
        </Pressable>
      ) : null}
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
  showAll: {
    minHeight: 48,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  showAllText: { fontSize: 14, fontWeight: "800" },
  documentTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  counts: { fontSize: 13, marginTop: 3 },
  row: {
    minHeight: 94,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
  },
  accent: { width: 3, borderRadius: 2, marginVertical: 3, marginRight: spacing.sm },
  selectionBox: { width: 48, alignItems: "center", justifyContent: "center" },
  main: { flex: 1, justifyContent: "center", gap: 5 },
  meta: { fontSize: 13, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { fontSize: 16, fontWeight: "800", flexShrink: 1 },
  voticBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  voticBadgeText: { fontSize: 10, fontWeight: "800" },
  text: { fontSize: 15, lineHeight: 22 },
  tags: { fontSize: 12, fontWeight: "700" },
  more: {
    width: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
});
