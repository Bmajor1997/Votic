import { editorial } from "../../design/editorial";
import { note_palette } from "../notePalette";
import { FeedbackPop } from "../../motion/FeedbackPop";
import { saved_motion_trigger, useMotionFeedback } from "../../motion/MotionFeedback";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { readable_title } from "../../documents/documentDisplay";
import { controlSizes, radii, spacing } from "../../design/tokens";
import { SavedPassage, VoticDocument } from "../../documents/types";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { note_selection_id } from "../askVoticNotesContext";
import { automatic_note_title, note_type_label } from "../noteMetadata";
import { date_label, NoteItem } from "../notesList";
import { notebook_counts_label } from "../notebookCounts";

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
  const colors = note_palette(document);
  const { event } = useMotionFeedback();
  const noteCount = passages.filter((passage) => passage.note.trim()).length;
  const savedCount = passages.length - noteCount;
  const title = readable_title(document.title);
  const shown = previewLimit ? passages.slice(0, previewLimit) : passages;
  const hidden = passages.length - shown.length;
  return (
    <View style={[s.group, { borderColor: colors.border, backgroundColor: theme.background }]}>
      {!inNotebook ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${title} notebook`}
          accessibilityHint={notebook_counts_label(noteCount, savedCount)}
          onPress={onOpenNotebook}
          style={({ pressed }) => [s.header, { backgroundColor: pressed ? colors.art : colors.surface }]}
        >
          <Ionicons name="create-outline" size={22} color={colors.ink} />
          <View style={s.headerCopy}>
            <Text numberOfLines={2} style={[s.documentTitle, { color: colors.ink }]}>
              {title} Notebook
            </Text>
            <Text style={[s.counts, { color: colors.detail }]}>
              {notebook_counts_label(noteCount, savedCount)}
            </Text>
          </View>
          {inNotebook ? (
            <Ionicons name="book-outline" size={20} color={theme.accent} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.detail} />
          )}
        </Pressable>
      ) : null}
      {shown.map((passage) => {
        const selectionId = note_selection_id(document.id, passage.id);
        const selected = selectedIds.includes(selectionId);
        const hasNote = Boolean(passage.note.trim());
        return (
          <FeedbackPop key={passage.id} trigger={saved_motion_trigger(event, "note", passage.id)}>
            <View
              style={[
                s.row,
                {
                  borderTopColor: colors.border,
                  backgroundColor: colors.paper,
                },
              ]}
            >
              <View
                style={[
                  s.accent,
                  {
                    backgroundColor: colors.strong,
                  },
                ]}
              />
              {selecting ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${selected ? "Deselect" : "Select"} note from ${title}`}
                  onPress={() => onToggleSelected(selectionId)}
                  style={s.selectionBox}
                >
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={23}
                    color={selected ? colors.strong : colors.detail}
                  />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View note from ${title}`}
                onPress={() => (selecting ? onToggleSelected(selectionId) : onView({ document, passage }))}
                style={({ pressed }) => [s.main, { opacity: pressed ? 0.68 : 1 }]}
              >
                <Text style={[s.meta, { color: colors.detail }]}>
                  {hasNote ? note_type_label(passage.noteType) : "Saved passage"} ·{" "}
                  {date_label(passage.updatedAt)}
                  {passage.pinned ? " · Pinned" : ""}
                </Text>
                {hasNote ? (
                  <View style={s.titleRow}>
                    <Text numberOfLines={1} style={[s.title, { color: colors.ink }]}>
                      {automatic_note_title(passage)}
                    </Text>
                    {passage.tags?.includes("votic") ? (
                      <View style={[s.voticBadge, { backgroundColor: colors.art }]}>
                        <Ionicons name="sparkles" size={12} color={colors.strong} />
                        <Text style={[s.voticBadgeText, { color: colors.strong }]}>Votic</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Text numberOfLines={3} style={[s.text, { color: colors.detail }]}>
                  {passage.note.trim() || passage.text}
                </Text>
                {passage.tags?.length ? (
                  <Text numberOfLines={1} style={[s.tags, { color: colors.strong }]}>
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
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.detail} />
              </Pressable>
            </View>
          </FeedbackPop>
        );
      })}
      {hidden > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Show all ${passages.length} from ${title}`}
          onPress={onOpenNotebook}
          style={({ pressed }) => [
            s.showAll,
            { borderTopColor: colors.border, backgroundColor: pressed ? colors.art : colors.surface },
          ]}
        >
          <Text style={[s.showAllText, { color: colors.ink }]}>Show all {passages.length}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.strong} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
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
    paddingVertical: spacing.lg,
    paddingLeft: spacing.md,
  },
  accent: { width: 3, borderRadius: 2, marginVertical: 3, marginRight: spacing.sm },
  selectionBox: { width: 48, alignItems: "center", justifyContent: "center" },
  main: { flex: 1, justifyContent: "center", gap: 5 },
  meta: { fontSize: 13, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { ...editorial, fontSize: 16, fontWeight: "800", flexShrink: 1 },
  voticBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  voticBadgeText: { fontSize: 10, fontWeight: "800" },
  text: { fontSize: 16, lineHeight: 24 },
  tags: { fontSize: 12, fontWeight: "700" },
  more: {
    width: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
});
