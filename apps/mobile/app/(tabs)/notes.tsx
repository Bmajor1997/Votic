import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  AccessibilityInfo,
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
import { SelectionBar, count_label } from "../../src/components/SelectionBar";
import { controlSizes, radii, spacing, typography } from "../../src/design/tokens";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { NoteType } from "../../src/documents/types";
import { new_quick_note_item, note_from_draft } from "../../src/notes/noteDraft";
import { note_selection_id } from "../../src/notes/askVoticNotesContext";
import { NotebookCard } from "../../src/notes/components/NotebookCard";
import { NotebookEmptyState } from "../../src/notes/components/NotebookEmptyState";
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

const NOTE_NOUN = { one: "note", many: "notes" };

export default function Notes() {
  const { theme } = useVoticTheme();
  const { width, fontScale } = useWindowDimensions();
  const { documents, loaded, open_document, save_passage, remove_passage, add_quick_note } =
    useDocumentLibrary();
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
  const emptyNotebook = Boolean(notebook && !notebook.savedPassages?.length);
  const tags = useMemo(() => available_tags(documents), [documents]);
  const groups = useMemo(
    () => note_groups(documents, { query, filter, dateFilter, tagFilter, notebookId }),
    [documents, query, filter, notebookId, dateFilter, tagFilter],
  );
  const hasNotes = documents.some((document) => (document.savedPassages || []).length > 0);
  // Quick Note waits only until something has been added to the library, not until a note exists.
  const canQuickNote = hasNotes || documents.some((document) => !document.notebookKind);
  // Home opens a single note here by its stable IDs, so a Quick Note shows that note, not the whole notebook.
  const requested = useRequestedNote(documents, loaded, setViewing);
  const walkthrough = useWalkthrough();
  const listTarget = useWalkthroughTarget("notes.list");
  const emptyTarget = useWalkthroughTarget("notes.empty");
  const searchTarget = useWalkthroughTarget("notes.search");
  const selectTarget = useWalkthroughTarget("notes.select");
  const quickNoteTarget = useWalkthroughTarget("notes.quickNote");
  useWalkthroughTrigger([{ id: "notes" }], { hasNotes, canQuickNote });
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
  function open_in_reader({ document, passage }: NoteItem) {
    setViewing(null);
    open_document(document.id, passage.sentenceIndex);
    router.push("/reader");
  }
  function start_quick_note() {
    setEditing(new_quick_note_item(notebook));
  }
  function save_note({ document, passage }: NoteItem, draft: NoteDraft) {
    if (!passage.text && !draft.note.trim()) return;
    if (document.id === "new-quick-note") {
      if (!add_quick_note(note_from_draft(passage, draft))) throw new Error("Free note limit reached");
      setEditing(null);
      setQuery("");
      clear_filters();
      return;
    }
    if (!save_passage(document.id, note_from_draft(passage, draft)))
      throw new Error("Free note limit reached");
    setEditing(null);
  }
  function toggle_pin({ document, passage }: NoteItem) {
    save_passage(document.id, { ...passage, pinned: !passage.pinned, updatedAt: Date.now() });
    // Shown after the options menu has closed, the first time something is pinned.
    if (!passage.pinned) setTimeout(() => walkthrough.request("notes.pinned"), 400);
  }
  /** Every note the list is showing, so Select all matches what the person can see. */
  const selectableIds = groups.flatMap((group) =>
    group.passages.map((passage) => note_selection_id(group.document.id, passage.id)),
  );
  function toggle_all_notes() {
    setSelectedIds((current) => (current.length >= selectableIds.length ? [] : selectableIds));
  }
  function confirm_remove_selected() {
    const items = selected_items();
    if (!items.length) return;
    const many = items.length > 1;
    Alert.alert(
      many ? `Remove ${items.length} notes?` : "Remove from Notes?",
      `${many ? "These notes and their saved passages move" : "This note and its saved passage move"} to Recently Deleted for 30 days. Restore them from Settings → Help.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            items.forEach(({ document, passage }) => remove_passage(document.id, passage.id));
            setSelectedIds([]);
            setSelecting(false);
            AccessibilityInfo.announceForAccessibility(
              `${count_label(items.length, NOTE_NOUN)} moved to Recently Deleted.`,
            );
          },
        },
      ],
    );
  }
  function confirm_remove({ document, passage }: NoteItem) {
    Alert.alert(
      "Remove from Notes?",
      "This note and its saved passage move to Recently Deleted for 30 days. Restore them from Settings → Help.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => remove_passage(document.id, passage.id) },
      ],
    );
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
        <QuickNoteAction visible={canQuickNote} on_press={start_quick_note} target={quickNoteTarget} />
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
          on_back={() => setNotebookId(null)}
          on_share={() =>
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
                <ActiveFilter label={filter_label(filter)} on_press={() => setFilter("all")} />
              ) : null}
              {dateFilter !== "all" ? (
                <ActiveFilter label={date_filter_label(dateFilter)} on_press={() => setDateFilter("all")} />
              ) : null}
              {tagFilter ? (
                <ActiveFilter label={`#${tagFilter}`} on_press={() => setTagFilter(null)} />
              ) : null}
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
            <View ref={selectTarget} collapsable={false}>
              <SelectionBar
                count={selectedIds.length}
                total={selectableIds.length}
                noun={NOTE_NOUN}
                prompt="Choose notes to share or delete"
                on_toggle_all={toggle_all_notes}
                on_delete={confirm_remove_selected}
                on_cancel={() => {
                  setSelecting(false);
                  setSelectedIds([]);
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Share ${count_label(selectedIds.length, NOTE_NOUN)}`}
                  onPress={() => share_items(selected_items(), `${selectedIds.length} selected Votic notes`)}
                  style={[s.pillButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                >
                  <Ionicons name="share-outline" size={17} color={theme.text} />
                  <Text style={[s.pillButtonText, { color: theme.text }]}>Share</Text>
                </Pressable>
              </SelectionBar>
            </View>
          ) : groups.length || (!browsing && !emptyNotebook) ? (
            <View style={s.summaryRow}>
              <Text style={[s.summary, { color: theme.mutedText }]}>{notes_summary(groups)}</Text>
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
              on_press={() => setNotebookId(document.id)}
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
                on_open_notebook={() => setNotebookId(document.id)}
                on_toggle_selected={toggle_selected}
                on_view={setViewing}
                on_more={setMenuItem}
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
      ) : notebook ? (
        <NotebookEmptyState
          notebook={notebook}
          on_open_document={() => {
            open_document(notebook.id);
            router.push("/reader");
          }}
        />
      ) : (
        <View ref={emptyTarget} collapsable={false} style={s.empty}>
          <NotesEmptyAnimation />
          <Text accessibilityRole="header" style={[s.emptyTitle, { color: theme.text }]}>
            Your notes will appear here
          </Text>
          <Text style={[s.emptyCopy, { color: theme.mutedText }]}>
            {documents.some((document) => !document.notebookKind)
              ? "Open a document from Documents, then save a passage or add a note while reading."
              : "Go to Documents to upload your first file, then save a passage or add a note while reading."}
          </Text>
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
        on_close={requested.close_viewer}
        on_edit={setEditing}
        on_more={setMenuItem}
        on_open_in_reader={(item) => {
          setViewing(null);
          open_in_reader(item);
        }}
      />
      <NotesFilterSheet
        visible={filterOpen}
        on_close={() => setFilterOpen(false)}
        filter={filter}
        on_filter_change={setFilter}
        dateFilter={dateFilter}
        on_date_filter_change={setDateFilter}
        tagFilter={tagFilter}
        on_tag_filter_change={setTagFilter}
        tags={tags}
        on_reset={clear_filters}
      />
      <NoteOptionsMenu
        item={menuItem}
        on_close={() => setMenuItem(null)}
        on_edit={setEditing}
        on_toggle_pin={toggle_pin}
        on_open_in_reader={open_in_reader}
        on_share={(item) => void share_items([item], automatic_note_title(item.passage))}
        on_remove={confirm_remove}
      />
      <NoteEditor item={editing} on_close={() => setEditing(null)} on_save={save_note} />
    </Screen>
  );
}

function QuickNoteAction({
  visible,
  on_press,
  target,
}: {
  visible: boolean;
  on_press: () => void;
  target: (node: View | null) => void;
}) {
  const { theme } = useVoticTheme();
  if (!visible) return null;
  return (
    <Pressable
      ref={target}
      accessibilityRole="button"
      accessibilityLabel="Quick Note"
      onPress={on_press}
      style={({ pressed }) => [s.askSelected, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name="add-outline" size={20} color="#FFF" />
      <Text style={s.askSelectedText}>Quick Note</Text>
    </Pressable>
  );
}

function filter_label(filter: NotesFilter) {
  if (filter === "notes") return "Notes";
  if (filter === "saved") return "Saved passages";
  if (filter === "pinned") return "Pinned";
  return note_type_label(filter as NoteType);
}

function ActiveFilter({ label, on_press }: { label: string; on_press: () => void }) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label} filter`}
      onPress={on_press}
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
  empty: {
    backgroundColor: "transparent",
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.sectionTitle },
  emptyCopy: { ...typography.body, textAlign: "center" },
});
