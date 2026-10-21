import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { NotesEmptyAnimation } from "../../src/components/EmptyStateIllustrations";
import { Screen } from "../../src/components/Screen";
import { controlSizes, radii, spacing, typography } from "../../src/design/tokens";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { NoteType } from "../../src/documents/types";
import { new_quick_note_item, note_from_draft } from "../../src/notes/noteDraft";
import { note_selection_id } from "../../src/notes/askVoticNotesContext";
import { NotebookCard } from "../../src/notes/components/NotebookCard";
import { NotebookHeader } from "../../src/notes/components/NotebookHeader";
import { NoteDraft, NoteEditor } from "../../src/notes/components/NoteEditor";
import { NoteGroupCard } from "../../src/notes/components/NoteGroupCard";
import { NoteOptionsMenu } from "../../src/notes/components/NoteOptionsMenu";
import { NotesFilterSheet } from "../../src/notes/components/NotesFilterSheet";
import { NoteViewer } from "../../src/notes/components/NoteViewer";
import { useRequestedNote } from "../../src/notes/useRequestedNote";
import { MissingNoteNotice } from "../../src/notes/components/MissingNoteNotice";
import { automatic_note_title, note_type_label } from "../../src/notes/noteMetadata";
import {
  advanced_filter_count,
  available_tags,
  DateFilter,
  date_filter_label,
  is_advanced_filter,
  note_groups,
  NoteItem,
  NotesFilter,
  notes_summary,
  share_text,
} from "../../src/notes/notesList";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import {
  useWalkthrough,
  useWalkthroughTarget,
  useWalkthroughTrigger,
} from "../../src/walkthrough/WalkthroughProvider";

export default function Notes() {
  const { theme } = useVoticTheme();
  const { width, fontScale } = useWindowDimensions();
  const { documents, loaded, openDocument, savePassage, removePassage, addQuickNote } = useDocumentLibrary();
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
  const activeFilterCount = advanced_filter_count({ filter, dateFilter, tagFilter });
  const tags = useMemo(() => available_tags(documents), [documents]);
  const groups = useMemo(
    () => note_groups(documents, { query, filter, dateFilter, tagFilter, notebookId }),
    [documents, query, filter, notebookId, dateFilter, tagFilter],
  );
  const hasNotes = documents.some((document) => (document.savedPassages || []).length > 0);
  // Home opens a single note here by its stable IDs, so a Quick Note shows that note, not the whole notebook.
  const requested = useRequestedNote(documents, loaded, setViewing);
  const walkthrough = useWalkthrough();
  const listTarget = useWalkthroughTarget("notes.list");
  const emptyTarget = useWalkthroughTarget("notes.empty");
  const searchTarget = useWalkthroughTarget("notes.search");
  const askTarget = useWalkthroughTarget("notes.ask");
  const selectTarget = useWalkthroughTarget("notes.select");
  useWalkthroughTrigger([{ id: "notes" }], { hasNotes });
  /** The first time someone starts choosing notes, explains what they can do with them. */
  function start_selecting() {
    setSelecting(true);
    setSelectedIds([]);
    setTimeout(() => walkthrough.request("notes.askSelected"), 300);
  }
  // Search and filters narrow notebooks by their matching notes.
  const browsing = !notebook && !query.trim() && filter === "all" && dateFilter === "all" && !tagFilter;

  const notebooks = useMemo(() => {
    const matching = new Set(groups.map((group) => group.document.id));
    return documents
      .filter(
        (document) =>
          browsing ||
          matching.has(document.id) ||
          (filter === "all" &&
            dateFilter === "all" &&
            !tagFilter &&
            !(document.savedPassages || []).length &&
            document.title.toLowerCase().includes(query.trim().toLowerCase())),
      )
      .sort((a, b) => {
        const latest = (document: typeof a) =>
          Math.max(document.importedAt, ...(document.savedPassages || []).map((note) => note.updatedAt));
        return latest(b) - latest(a);
      });
  }, [documents, groups, browsing, filter, dateFilter, tagFilter, query]);

  async function share_items(items: NoteItem[], title: string) {
    if (!items.length) return;
    try {
      await Share.share({ title, message: share_text(items, title) });
    } catch {
      Alert.alert("Couldn’t share notes", "Please try sharing again.");
    }
  }
  function toggle_selected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  function selected_items() {
    return groups.flatMap((group) =>
      group.passages
        .filter((passage) => selectedIds.includes(note_selection_id(group.document.id, passage.id)))
        .map((passage) => ({ document: group.document, passage })),
    );
  }
  function ask_selected() {
    if (!selectedIds.length) return;
    router.push({
      pathname: "/assistant",
      params: {
        notesPassageIds: selectedIds.join(","),
        initialQuestion: "Help me understand these selected notes",
      },
    });
  }
  function open_in_reader({ document, passage }: NoteItem) {
    setViewing(null);
    openDocument(document.id, passage.sentenceIndex);
    router.push("/reader");
  }
  function ask_about_notes(documentId: string, passageId?: string, initialQuestion?: string) {
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
  function start_quick_note() {
    setEditing(new_quick_note_item(notebook));
  }
  function save_note({ document, passage }: NoteItem, draft: NoteDraft) {
    if (!passage.text && !draft.note.trim()) return;
    if (document.id === "new-quick-note") {
      addQuickNote(note_from_draft(passage, draft));
      setEditing(null);
      setQuery("");
      clear_filters();
      return;
    }
    savePassage(document.id, note_from_draft(passage, draft));
    setEditing(null);
  }
  function toggle_pin({ document, passage }: NoteItem) {
    savePassage(document.id, { ...passage, pinned: !passage.pinned, updatedAt: Date.now() });
    // Shown after the options menu has closed, the first time something is pinned.
    if (!passage.pinned) setTimeout(() => walkthrough.request("notes.pinned"), 400);
  }
  function confirm_remove({ document, passage }: NoteItem) {
    Alert.alert("Remove from Notes?", "This note and its saved passage will be removed from Votic.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removePassage(document.id, passage.id) },
    ]);
  }
  function clear_filters() {
    setFilter("all");
    setDateFilter("all");
    setTagFilter(null);
  }

  return (
    <Screen
      title="Notes"
      titleAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick Note"
          onPress={start_quick_note}
          style={({ pressed }) => [
            s.askSelected,
            { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="add-outline" size={20} color="#FFF" />
          <Text style={s.askSelectedText}>Quick Note</Text>
        </Pressable>
      }
    >
      <MissingNoteNotice visible={requested.missing} />
      {!notebook ? (
        <View style={{ gap: 6 }}>
          <Text accessibilityRole="header" style={[s.emptyTitle, { color: theme.text }]}>
            Your notebooks
          </Text>
          <Text style={{ color: theme.mutedText, fontSize: 15, lineHeight: 22 }}>
            A place for every document’s ideas.
          </Text>
        </View>
      ) : null}
      {notebook ? (
        <NotebookHeader
          notebook={notebook}
          onBack={() => setNotebookId(null)}
          onAsk={(initialQuestion) => ask_about_notes(notebook.id, undefined, initialQuestion)}
          onShare={() =>
            share_items(
              (notebook.savedPassages || []).map((passage) => ({ document: notebook, passage })),
              `${notebook.title} — Votic Notebook`,
            )
          }
        />
      ) : null}
      {documents.length ? (
        <>
          <View
            ref={searchTarget}
            collapsable={false}
            style={[s.search, { backgroundColor: theme.surface, borderColor: theme.border }]}
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
                color={activeFilterCount ? theme.accentText : theme.text}
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
              {is_advanced_filter(filter) ? (
                <ActiveFilter label={filter_label(filter)} onPress={() => setFilter("all")} />
              ) : null}
              {dateFilter !== "all" ? (
                <ActiveFilter label={date_filter_label(dateFilter)} onPress={() => setDateFilter("all")} />
              ) : null}
              {tagFilter ? <ActiveFilter label={`#${tagFilter}`} onPress={() => setTagFilter(null)} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                onPress={clear_filters}
                style={s.clearFilters}
              >
                <Text style={[s.clearFiltersText, { color: theme.accentText }]}>Clear</Text>
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
                        share_items(selected_items(), `${selectedIds.length} selected Votic notes`)
                      }
                      style={[s.pillButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                    >
                      <Ionicons name="share-outline" size={17} color={theme.text} />
                      <Text style={[s.pillButtonText, { color: theme.text }]}>Share</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ask Votic about ${selectedIds.length} selected notes`}
                      onPress={ask_selected}
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
                  style={[s.pillButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                >
                  <Text style={[s.pillButtonText, { color: theme.mutedText }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : groups.length || !browsing ? (
            <View style={s.summaryRow}>
              <Text style={[s.summary, { color: theme.mutedText }]}>{notes_summary(groups)}</Text>
              {groups.length && !notebook ? (
                <Pressable
                  ref={askTarget}
                  accessibilityRole="button"
                  accessibilityLabel="Ask Votic about notes"
                  accessibilityHint="Choose which notes to ask about"
                  onPress={start_selecting}
                  style={[s.pillButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                >
                  <Ionicons name="sparkles-outline" size={16} color={theme.accentText} />
                  <Text style={[s.pillButtonText, { color: theme.accentText }]}>Ask</Text>
                </Pressable>
              ) : null}
              {groups.length ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select notes"
                  onPress={start_selecting}
                  style={[s.pillButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                >
                  <Ionicons name="checkmark-circle-outline" size={17} color={theme.accentText} />
                  <Text style={[s.pillButtonText, { color: theme.accentText }]}>Select</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
      {!notebook && !selecting && notebooks.length ? (
        <View
          // Before any notes, the walkthrough explains where they come from, over the notebooks.
          ref={hasNotes ? listTarget : emptyTarget}
          collapsable={false}
          style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
        >
          {notebooks.map((document) => (
            <NotebookCard
              key={document.id}
              document={document}
              fullWidth={width < 360 || fontScale > 1.3}
              onPress={() => setNotebookId(document.id)}
            />
          ))}
        </View>
      ) : groups.length ? (
        <View ref={listTarget} collapsable={false} style={s.list}>
          {groups.map(({ document, passages }) => (
            <View key={document.id}>
              <NoteGroupCard
                document={document}
                passages={passages}
                inNotebook={Boolean(notebook)}
                selecting={selecting}
                selectedIds={selectedIds}
                onOpenNotebook={() => setNotebookId(document.id)}
                onToggleSelected={toggle_selected}
                onView={setViewing}
                onMore={setMenuItem}
              />
            </View>
          ))}
        </View>
      ) : query.trim() || activeFilterCount ? (
        <View style={s.empty}>
          <Ionicons name="search-outline" size={32} color={theme.mutedText} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>No matches</Text>
          <Text style={[s.emptyCopy, { color: theme.mutedText }]}>Try another search or filter.</Text>
        </View>
      ) : (
        <View ref={emptyTarget} collapsable={false} style={s.empty}>
          <NotesEmptyAnimation />
          <Text accessibilityRole="header" style={[s.emptyTitle, { color: theme.text }]}>
            {notebook ? "No notes yet" : "Keep what matters."}
          </Text>
          <Text style={[s.emptyCopy, { color: theme.mutedText }]}>
            {notebook
              ? "Add a Quick Note, or save a passage while reading. Your ideas will live in this notebook."
              : "Open a document to begin your notebook collection, or write a Quick Note."}
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
        item={
          viewing && !editing && !menuItem
            ? (() => {
                const document = documents.find((document) => document.id === viewing.document.id);
                const passage = document?.savedPassages?.find((passage) => passage.id === viewing.passage.id);
                return document && passage ? { document, passage } : null;
              })()
            : null
        }
        onClose={requested.closeViewer}
        onAsk={(item, question) => ask_about_notes(item.document.id, item.passage.id, question)}
        onEdit={setEditing}
        onMore={setMenuItem}
        onOpenInReader={(item) => {
          setViewing(null);
          open_in_reader(item);
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
        onReset={clear_filters}
      />
      <NoteOptionsMenu
        item={menuItem}
        onClose={() => setMenuItem(null)}
        onEdit={setEditing}
        onTogglePin={toggle_pin}
        onOpenInReader={open_in_reader}
        onShare={(item) => void share_items([item], automatic_note_title(item.passage))}
        onRemove={confirm_remove}
      />
      <NoteEditor item={editing} onClose={() => setEditing(null)} onSave={save_note} />
    </Screen>
  );
}

function filter_label(filter: NotesFilter) {
  if (filter === "notes") return "Notes";
  if (filter === "saved") return "Saved passages";
  if (filter === "pinned") return "Pinned";
  return note_type_label(filter as NoteType);
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
      <Text numberOfLines={1} style={[s.activeFilterText, { color: theme.accentText }]}>
        {label}
      </Text>
      <Ionicons name="close" size={14} color={theme.accentText} />
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
    borderWidth: 1,
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
