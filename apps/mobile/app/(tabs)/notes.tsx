import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { NotesEmptyAnimation } from "../../src/components/EmptyStateIllustrations";
import { Screen, ScrollFadeItem } from "../../src/components/Screen";
import { controlSizes, radii, spacing, typography } from "../../src/design/tokens";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { NoteType } from "../../src/documents/types";
import { noteSelectionId } from "../../src/notes/askVoticNotesContext";
import { NotebookHeader } from "../../src/notes/components/NotebookHeader";
import { NoteDraft, NoteEditor } from "../../src/notes/components/NoteEditor";
import { NoteGroupCard } from "../../src/notes/components/NoteGroupCard";
import { NoteOptionsMenu } from "../../src/notes/components/NoteOptionsMenu";
import { NotesFilterSheet } from "../../src/notes/components/NotesFilterSheet";
import { NoteViewer } from "../../src/notes/components/NoteViewer";
import { automaticNoteTitle, cleanTags, noteTypeLabel } from "../../src/notes/noteMetadata";
import {
  advancedFilterCount,
  availableTags,
  DateFilter,
  dateFilterLabel,
  isAdvancedFilter,
  noteGroups,
  NoteItem,
  NotesFilter,
  shareText,
} from "../../src/notes/notesList";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import {
  useWalkthrough,
  useWalkthroughTarget,
  useWalkthroughTrigger,
} from "../../src/walkthrough/WalkthroughProvider";

export default function Notes() {
  const { theme } = useVoticTheme();
  const { documents, openDocument, savePassage, removePassage } = useDocumentLibrary();
  const [query, setQuery] = useState("");
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotesFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<NoteItem | null>(null);
  const [viewing, setViewing] = useState<NoteItem | null>(null);
  const [menuItem, setMenuItem] = useState<NoteItem | null>(null);
  const notebook = notebookId ? documents.find((document) => document.id === notebookId) : undefined;
  const activeFilterCount = advancedFilterCount({ filter, dateFilter, tagFilter });
  const tags = useMemo(() => availableTags(documents), [documents]);
  const groups = useMemo(
    () => noteGroups(documents, { query, filter, dateFilter, tagFilter, notebookId }),
    [documents, query, filter, notebookId, dateFilter, tagFilter],
  );
  const hasNotes = documents.some((document) => (document.savedPassages || []).length > 0);
  const walkthrough = useWalkthrough();
  const listTarget = useWalkthroughTarget("notes.list");
  const emptyTarget = useWalkthroughTarget("notes.empty");
  const searchTarget = useWalkthroughTarget("notes.search");
  const askTarget = useWalkthroughTarget("notes.ask");
  const selectTarget = useWalkthroughTarget("notes.select");
  useWalkthroughTrigger([{ id: "notes" }], { hasNotes });
  /** The first time someone starts choosing notes, explains what they can do with them. */
  function startSelecting() {
    setSelecting(true);
    setSelectedIds([]);
    setTimeout(() => walkthrough.request("notes.askSelected"), 300);
  }
  const itemCount = groups.reduce((total, group) => total + group.passages.length, 0);
  // While browsing everything, each document shows its newest notes; searching or filtering shows all matches.
  const browsing = !notebook && !query.trim() && filter === "all" && dateFilter === "all" && !tagFilter;

  async function shareItems(items: NoteItem[], title: string) {
    if (!items.length) return;
    try {
      await Share.share({ title, message: shareText(items, title) });
    } catch {
      Alert.alert("Couldn’t share notes", "Please try sharing again.");
    }
  }
  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  function selectedItems() {
    return groups.flatMap((group) =>
      group.passages
        .filter((passage) => selectedIds.includes(noteSelectionId(group.document.id, passage.id)))
        .map((passage) => ({ document: group.document, passage })),
    );
  }
  function askSelected() {
    if (!selectedIds.length) return;
    router.push({
      pathname: "/assistant",
      params: {
        notesPassageIds: selectedIds.join(","),
        initialQuestion: "Help me understand these selected notes",
      },
    });
  }
  function openInReader({ document, passage }: NoteItem) {
    openDocument(document.id, passage.sentenceIndex);
    router.push("/reader");
  }
  function askAboutNotes(documentId: string, passageId?: string, initialQuestion?: string) {
    setViewing(null);
    setMenuItem(null);
    router.push({
      pathname: "/assistant",
      params: {
        notesDocumentId: documentId,
        ...(passageId ? { notesPassageId: passageId } : {}),
        ...(initialQuestion ? { initialQuestion } : {}),
      },
    });
  }
  function saveNote({ document, passage }: NoteItem, draft: NoteDraft) {
    savePassage(document.id, {
      ...passage,
      note: draft.note.trim(),
      title: draft.title.trim() || undefined,
      noteType: draft.noteType,
      tags: cleanTags(draft.tags),
      updatedAt: Date.now(),
    });
    setEditing(null);
  }
  function togglePin({ document, passage }: NoteItem) {
    savePassage(document.id, { ...passage, pinned: !passage.pinned, updatedAt: Date.now() });
    // Shown after the options menu has closed, the first time something is pinned.
    if (!passage.pinned) setTimeout(() => walkthrough.request("notes.pinned"), 400);
  }
  function confirmRemove({ document, passage }: NoteItem) {
    Alert.alert("Remove from Notes?", "This note and its saved passage will be removed from Votic.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removePassage(document.id, passage.id) },
    ]);
  }
  function clearFilters() {
    setFilter("all");
    setDateFilter("all");
    setTagFilter(null);
  }

  return (
    <Screen title={notebook ? notebook.title + " Notebook" : "Notes"}>
      {notebook ? (
        <NotebookHeader
          notebook={notebook}
          onBack={() => setNotebookId(null)}
          onAsk={(initialQuestion) => askAboutNotes(notebook.id, undefined, initialQuestion)}
          onShare={() =>
            shareItems(
              (notebook.savedPassages || []).map((passage) => ({ document: notebook, passage })),
              `${notebook.title} — Votic Notebook`,
            )
          }
        />
      ) : null}
      {hasNotes ? (
        <>
          <View
            ref={searchTarget}
            collapsable={false}
            style={[s.search, { backgroundColor: theme.surfaceMuted }]}
          >
            <Ionicons name="search" size={19} color={theme.mutedText} />
            <TextInput
              accessibilityLabel="Search notes"
              value={query}
              onChangeText={setQuery}
              placeholder="Search notes, titles, tags"
              placeholderTextColor={theme.mutedText}
              style={[s.input, { color: theme.text }]}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery("")}
                style={s.clear}
              >
                <Ionicons name="close-circle" size={20} color={theme.mutedText} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={activeFilterCount ? `Filters, ${activeFilterCount} active` : "Filters"}
              accessibilityState={{ expanded: filterOpen }}
              onPress={() => setFilterOpen(true)}
              style={[
                s.filterTrigger,
                {
                  borderColor: activeFilterCount ? theme.accent : theme.border,
                  backgroundColor: activeFilterCount ? theme.sentenceHighlight : theme.surface,
                },
              ]}
            >
              <Ionicons
                name="options-outline"
                size={19}
                color={activeFilterCount ? theme.accent : theme.text}
              />
              {activeFilterCount ? (
                <View style={[s.filterCount, { backgroundColor: theme.accent }]}>
                  <Text style={s.filterCountText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
          {activeFilterCount ? (
            <View style={s.activeFilters}>
              {isAdvancedFilter(filter) ? (
                <ActiveFilter label={filterLabel(filter)} onPress={() => setFilter("all")} />
              ) : null}
              {dateFilter !== "all" ? (
                <ActiveFilter label={dateFilterLabel(dateFilter)} onPress={() => setDateFilter("all")} />
              ) : null}
              {tagFilter ? <ActiveFilter label={`#${tagFilter}`} onPress={() => setTagFilter(null)} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                onPress={clearFilters}
                style={s.clearFilters}
              >
                <Text style={[s.clearFiltersText, { color: theme.accent }]}>Clear</Text>
              </Pressable>
            </View>
          ) : null}
          {selecting ? (
            <View
              ref={selectTarget}
              collapsable={false}
              style={[s.selectionBar, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <Text accessibilityLiveRegion="polite" style={[s.selectedCount, { color: theme.text }]}>
                {selectedIds.length ? `${selectedIds.length} selected` : "Choose notes to ask about or share"}
              </Text>
              <View style={s.selectionActions}>
                {selectedIds.length ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Share ${selectedIds.length} selected notes`}
                      onPress={() =>
                        shareItems(selectedItems(), `${selectedIds.length} selected Votic notes`)
                      }
                      style={[s.pillButton, { borderColor: theme.border }]}
                    >
                      <Ionicons name="share-outline" size={17} color={theme.text} />
                      <Text style={[s.pillButtonText, { color: theme.text }]}>Share</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ask Votic about ${selectedIds.length} selected notes`}
                      onPress={askSelected}
                      style={[s.askSelected, { backgroundColor: theme.accent }]}
                    >
                      <Ionicons name="sparkles-outline" size={16} color="#FFF" />
                      <Text style={s.askSelectedText}>Ask Votic</Text>
                    </Pressable>
                  </>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel note selection"
                  onPress={() => {
                    setSelecting(false);
                    setSelectedIds([]);
                  }}
                  style={[s.pillButton, { borderColor: theme.border }]}
                >
                  <Text style={[s.pillButtonText, { color: theme.mutedText }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={s.summaryRow}>
              <Text style={[s.summary, { color: theme.mutedText }]}>
                {itemCount} {itemCount === 1 ? "item" : "items"} from {groups.length}{" "}
                {groups.length === 1 ? "document" : "documents"}
              </Text>
              {groups.length && !notebook ? (
                <Pressable
                  ref={askTarget}
                  accessibilityRole="button"
                  accessibilityLabel="Ask Votic about notes"
                  accessibilityHint="Choose which notes to ask about"
                  onPress={startSelecting}
                  style={[s.pillButton, { borderColor: theme.border }]}
                >
                  <Ionicons name="sparkles-outline" size={16} color={theme.accent} />
                  <Text style={[s.pillButtonText, { color: theme.accent }]}>Ask</Text>
                </Pressable>
              ) : null}
              {groups.length ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select notes"
                  onPress={startSelecting}
                  style={[s.pillButton, { borderColor: theme.border }]}
                >
                  <Ionicons name="checkmark-circle-outline" size={17} color={theme.accent} />
                  <Text style={[s.pillButtonText, { color: theme.accent }]}>Select</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </>
      ) : null}
      {groups.length ? (
        <View ref={listTarget} collapsable={false} style={s.list}>
          {groups.map(({ document, passages }) => (
            <ScrollFadeItem key={document.id}>
              <NoteGroupCard
                document={document}
                passages={passages}
                inNotebook={Boolean(notebook)}
                selecting={selecting}
                selectedIds={selectedIds}
                previewLimit={browsing && !selecting ? 2 : undefined}
                onOpenNotebook={() => setNotebookId(document.id)}
                onToggleSelected={toggleSelected}
                onView={setViewing}
                onMore={setMenuItem}
              />
            </ScrollFadeItem>
          ))}
        </View>
      ) : hasNotes ? (
        <View style={s.empty}>
          <Ionicons name="search-outline" size={32} color={theme.mutedText} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>No matches</Text>
          <Text style={[s.emptyCopy, { color: theme.mutedText }]}>Try another search or filter.</Text>
        </View>
      ) : (
        <View ref={emptyTarget} collapsable={false} style={s.empty}>
          <NotesEmptyAnimation />
          <Text accessibilityRole="header" style={[s.emptyTitle, { color: theme.text }]}>
            Keep what matters.
          </Text>
          <Text style={[s.emptyCopy, { color: theme.mutedText }]}>
            Save a passage or add a thought. Find it here, linked to your document.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open a document"
            onPress={() => router.push("/documents")}
            style={({ pressed }) => [
              s.emptyAction,
              { backgroundColor: theme.accent, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Ionicons name="book-outline" size={19} color="#FFF" />
            <Text style={s.emptyActionText}>Open a document</Text>
          </Pressable>
        </View>
      )}
      <NoteViewer
        item={viewing}
        onClose={() => setViewing(null)}
        onAsk={(item) => askAboutNotes(item.document.id, item.passage.id)}
        onOpenInReader={(item) => {
          setViewing(null);
          openInReader(item);
        }}
      />
      <NotesFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        onFilterChange={setFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        tags={tags}
        onReset={clearFilters}
      />
      <NoteOptionsMenu
        item={menuItem}
        onClose={() => setMenuItem(null)}
        onEdit={setEditing}
        onTogglePin={togglePin}
        onOpenInReader={openInReader}
        onShare={(item) => void shareItems([item], automaticNoteTitle(item.passage))}
        onRemove={confirmRemove}
      />
      <NoteEditor item={editing} onClose={() => setEditing(null)} onSave={saveNote} />
    </Screen>
  );
}

function filterLabel(filter: NotesFilter) {
  if (filter === "notes") return "Notes";
  if (filter === "saved") return "Saved passages";
  if (filter === "pinned") return "Pinned";
  return noteTypeLabel(filter as NoteType);
}

function ActiveFilter({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label} filter`}
      onPress={onPress}
      style={[s.activeFilter, { borderColor: theme.accent, backgroundColor: theme.sentenceHighlight }]}
    >
      <Text numberOfLines={1} style={[s.activeFilterText, { color: theme.accent }]}>
        {label}
      </Text>
      <Ionicons name="close" size={14} color={theme.accent} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  summaryRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  summary: { flex: 1, fontSize: 14 },
  selectionBar: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  selectionActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  emptyAction: {
    minHeight: 52,
    alignSelf: "stretch",
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyActionText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  pillButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pillButtonText: { fontSize: 13, fontWeight: "800" },
  selectedCount: { fontSize: 14, fontWeight: "700" },
  askSelected: {
    minHeight: 44,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  askSelectedText: { color: "#FFF", fontSize: 13, fontWeight: "800" },
  search: {
    minHeight: 46,
    borderRadius: radii.md,
    paddingLeft: spacing.md,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: { flex: 1, minHeight: 44, fontSize: 14 },
  clear: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  filterTrigger: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCount: {
    position: "absolute",
    right: 2,
    top: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountText: { color: "#FFF", fontSize: 9, fontWeight: "900" },
  activeFilters: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  activeFilter: {
    maxWidth: 180,
    minHeight: 32,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activeFilterText: { fontSize: 12, fontWeight: "800", flexShrink: 1 },
  clearFilters: {
    minHeight: 32,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  clearFiltersText: { fontSize: 12, fontWeight: "800" },
  list: { gap: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  emptyTitle: { ...typography.sectionTitle },
  emptyCopy: { ...typography.body, textAlign: "center" },
});
