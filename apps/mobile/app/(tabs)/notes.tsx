import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen, ScrollFadeItem } from "../../src/components/Screen";
import { controlSizes, radii, spacing, typography } from "../../src/design/tokens";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { NoteType, SavedPassage, VoticDocument } from "../../src/documents/types";
import { automaticNoteTitle, cleanTags, NOTE_TYPES, noteTypeLabel } from "../../src/notes/noteMetadata";
import { noteSelectionId } from "../../src/notes/askVoticNotesContext";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { NotesEmptyAnimation } from "../../src/components/EmptyStateIllustrations";
import { DocumentTypeIcon, documentTypeColor } from "../../src/components/DocumentTypeIcon";
import { useVoticPurpose } from "../../src/personalization/PurposeProvider";

type Filter = "all" | "notes" | "saved" | "pinned" | "key-point" | "question" | "definition";
type DateFilter = "all" | "today" | "week" | "month";
type NoteItem = { document: VoticDocument; passage: SavedPassage };
function shareText(items: NoteItem[], title: string) {
  const body = items
    .map(
      ({ document, passage }, index) =>
        `${index + 1}. ${automaticNoteTitle(passage)}\n${passage.note.trim() || passage.text}\nSource: ${document.title}${passage.tags?.length ? `\nTags: ${passage.tags.map((tag) => `#${tag}`).join(" ")}` : ""}`,
    )
    .join("\n\n");
  return `${title}\n\n${body}\n\nShared from Votic`;
}
function dateLabel(value: number) {
  const date = new Date(value),
    today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Notes() {
  const { theme } = useVoticTheme();
  const { purpose } = useVoticPurpose();
  const { documents, openDocument, savePassage, removePassage } = useDocumentLibrary();
  const [query, setQuery] = useState("");
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<NoteItem | null>(null);
  const [viewing, setViewing] = useState<NoteItem | null>(null);
  const [menuItem, setMenuItem] = useState<NoteItem | null>(null);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftType, setDraftType] = useState<NoteType>("note");
  const [draftTags, setDraftTags] = useState("");
  const notebook = notebookId ? documents.find((document) => document.id === notebookId) : undefined;
  const advancedFilterCount =
    Number(["pinned", "key-point", "question", "definition"].includes(filter)) +
    Number(dateFilter !== "all") +
    Number(Boolean(tagFilter));
  const availableTags = useMemo(
    () =>
      [
        ...new Set(
          documents.flatMap((document) =>
            (document.savedPassages || []).flatMap((passage) => passage.tags || []),
          ),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [documents],
  );
  const groups = useMemo(
    () =>
      documents
        .map((document) => {
          const passages = (document.savedPassages || [])
            .filter((passage) => {
              if (notebookId && document.id !== notebookId) return false;
              if (filter === "notes" && !passage.note.trim()) return false;
              if (filter === "saved" && passage.note.trim()) return false;
              if (filter === "pinned" && !passage.pinned) return false;
              if (
                ["key-point", "question", "definition"].includes(filter) &&
                (passage.noteType || "note") !== filter
              )
                return false;
              if (tagFilter && !(passage.tags || []).includes(tagFilter)) return false;
              if (dateFilter !== "all") {
                const age = Date.now() - passage.updatedAt;
                const limit =
                  dateFilter === "today" ? 86400000 : dateFilter === "week" ? 604800000 : 2592000000;
                if (age > limit) return false;
              }
              const needle = query.trim().toLocaleLowerCase();
              const searchable = [
                document.title,
                passage.text,
                passage.note,
                passage.title || "",
                noteTypeLabel(passage.noteType),
                ...(passage.tags || []),
              ]
                .join(" ")
                .toLocaleLowerCase();
              return !needle || searchable.includes(needle);
            })
            .sort((a, b) =>
              notebookId
                ? Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt
                : b.updatedAt - a.updatedAt,
            );
          return { document, passages };
        })
        .filter((group) => group.passages.length)
        .sort((a, b) => b.passages[0].updatedAt - a.passages[0].updatedAt),
    [documents, query, filter, notebookId, dateFilter, tagFilter],
  );

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
  function open(documentId: string, sentenceIndex: number) {
    openDocument(documentId, sentenceIndex);
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
  function edit(document: VoticDocument, passage: SavedPassage) {
    setEditing({ document, passage });
    setDraft(passage.note);
    setDraftTitle(passage.title || "");
    setDraftType(passage.noteType || "note");
    setDraftTags((passage.tags || []).join(", "));
  }
  function save() {
    if (!editing) return;
    savePassage(editing.document.id, {
      ...editing.passage,
      note: draft.trim(),
      title: draftTitle.trim() || undefined,
      noteType: draftType,
      tags: cleanTags(draftTags),
      updatedAt: Date.now(),
    });
    setEditing(null);
    setDraft("");
    setDraftTitle("");
    setDraftTags("");
  }
  function remove() {
    if (!menuItem) return;
    const selected = menuItem;
    setMenuItem(null);
    Alert.alert("Remove from Notes?", "This note and its saved passage will be removed from Votic.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removePassage(selected.document.id, selected.passage.id),
      },
    ]);
  }

  return (
    <Screen title={notebook ? notebook.title + " Notebook" : "Notes"}>
      {notebook ? (
        <View style={[s.notebookHero, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to all notes"
            onPress={() => setNotebookId(null)}
            style={s.notebookBack}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
            <Text style={[s.notebookBackText, { color: theme.text }]}>All Notes</Text>
          </Pressable>
          <View style={s.notebookHeading}>
            <DocumentTypeIcon sourceName={notebook.sourceName} size={44} />
            <View style={s.notebookCopy}>
              <Text numberOfLines={2} style={[s.notebookTitle, { color: theme.text }]}>
                {notebook.title}
              </Text>
              <Text style={[s.counts, { color: theme.mutedText }]}>
                {(notebook.savedPassages || []).filter((p) => p.note.trim()).length} notes ·{" "}
                {(notebook.savedPassages || []).filter((p) => !p.note.trim()).length} saved passages
              </Text>
            </View>
          </View>
          <View style={s.notebookStats}>
            <NotebookStat
              label="Pinned"
              value={(notebook.savedPassages || []).filter((p) => p.pinned).length}
            />
            <NotebookStat
              label="Key Points"
              value={(notebook.savedPassages || []).filter((p) => p.noteType === "key-point").length}
            />
            <NotebookStat
              label="Questions"
              value={(notebook.savedPassages || []).filter((p) => p.noteType === "question").length}
            />
            <NotebookStat
              label="Definitions"
              value={(notebook.savedPassages || []).filter((p) => p.noteType === "definition").length}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ask Votic about ${notebook.title} notebook`}
            onPress={() => askAboutNotes(notebook.id)}
            style={[s.notebookAsk, { backgroundColor: theme.accent }]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={19} color="#FFF" />
            <Text style={s.notebookAskText}>Ask Votic about this notebook</Text>
          </Pressable>
          <View style={s.notebookActions}>
            <NotebookAction
              icon="share-outline"
              label="Share notebook"
              onPress={() =>
                shareItems(
                  (notebook.savedPassages || []).map((passage) => ({ document: notebook, passage })),
                  `${notebook.title} — Votic Notebook`,
                )
              }
            />
            <NotebookAction
              icon="sparkles-outline"
              label="Summarize notes"
              onPress={() => askAboutNotes(notebook.id, undefined, "Summarize my notes from this document")}
            />
            {purpose === "learning" ? (
              <NotebookAction
                icon="school-outline"
                label="Quiz me"
                onPress={() => askAboutNotes(notebook.id, undefined, "Quiz me on these notes")}
              />
            ) : purpose === "work" ? (
              <NotebookAction
                icon="checkbox-outline"
                label="Action items"
                onPress={() =>
                  askAboutNotes(notebook.id, undefined, "Find the action items and decisions in my notes")
                }
              />
            ) : purpose === "research" ? (
              <NotebookAction
                icon="flask-outline"
                label="Key findings"
                onPress={() =>
                  askAboutNotes(notebook.id, undefined, "Identify the key findings and evidence in my notes")
                }
              />
            ) : (
              <NotebookAction
                icon="key-outline"
                label="Key points"
                onPress={() =>
                  askAboutNotes(notebook.id, undefined, "Find the most important points in my notes")
                }
              />
            )}
            <NotebookAction
              icon="bulb-outline"
              label={purpose === "learning" ? "Explain key ideas" : "Explain"}
              onPress={() => askAboutNotes(notebook.id, undefined, "Explain the key ideas in my notes")}
            />
          </View>
        </View>
      ) : null}
      <View style={s.selectionHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selecting ? "Cancel note selection" : "Select notes"}
          onPress={() => {
            setSelecting((value) => !value);
            setSelectedIds([]);
          }}
          style={[s.selectButton, { borderColor: theme.border }]}
        >
          <Ionicons name={selecting ? "close" : "checkmark-circle-outline"} size={18} color={theme.accent} />
          <Text style={[s.selectButtonText, { color: theme.accent }]}>{selecting ? "Cancel" : "Select"}</Text>
        </Pressable>
        {selecting ? (
          <Text style={[s.selectedCount, { color: theme.mutedText }]}>{selectedIds.length} selected</Text>
        ) : null}
        {selecting && selectedIds.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Share ${selectedIds.length} selected notes`}
            onPress={() =>
              shareItems(
                groups.flatMap((group) =>
                  group.passages
                    .filter((p) => selectedIds.includes(noteSelectionId(group.document.id, p.id)))
                    .map((passage) => ({ document: group.document, passage })),
                ),
                `${selectedIds.length} selected Votic notes`,
              )
            }
            style={[s.shareSelected, { borderColor: theme.border }]}
          >
            <Ionicons name="share-outline" size={17} color={theme.accent} />
            <Text style={[s.shareSelectedText, { color: theme.accent }]}>Share</Text>
          </Pressable>
        ) : null}
        {selecting && selectedIds.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ask Votic about ${selectedIds.length} selected notes`}
            onPress={askSelected}
            style={[s.askSelected, { backgroundColor: theme.accent }]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={17} color="#FFF" />
            <Text style={s.askSelectedText}>Ask Votic</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[s.search, { backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name="search" size={19} color={theme.mutedText} />
        <TextInput
          accessibilityLabel="Search notes"
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes, titles, tags..."
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
          accessibilityLabel={advancedFilterCount ? `Filters, ${advancedFilterCount} active` : "Filters"}
          accessibilityState={{ expanded: filterOpen }}
          onPress={() => setFilterOpen(true)}
          style={[
            s.filterTrigger,
            {
              borderColor: advancedFilterCount ? theme.accent : theme.border,
              backgroundColor: advancedFilterCount ? theme.sentenceHighlight : theme.surface,
            },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={19}
            color={advancedFilterCount ? theme.accent : theme.text}
          />
          {advancedFilterCount ? (
            <View style={[s.filterCount, { backgroundColor: theme.accent }]}>
              <Text style={s.filterCountText}>{advancedFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      <View style={s.primaryFilters}>
        <FilterButton label="All Notes" value="all" current={filter} onPress={setFilter} />
        <FilterButton label="Notes" value="notes" current={filter} onPress={setFilter} />
        <FilterButton label="Saved Passages" value="saved" current={filter} onPress={setFilter} />
      </View>
      {advancedFilterCount ? (
        <View style={s.activeFilters}>
          {["pinned", "key-point", "question", "definition"].includes(filter) ? (
            <ActiveFilter
              label={filter === "pinned" ? "Pinned" : noteTypeLabel(filter as NoteType)}
              onPress={() => setFilter("all")}
            />
          ) : null}
          {dateFilter !== "all" ? (
            <ActiveFilter
              label={
                dateFilter === "today" ? "Today" : dateFilter === "week" ? "Last 7 days" : "Last 30 days"
              }
              onPress={() => setDateFilter("all")}
            />
          ) : null}
          {tagFilter ? <ActiveFilter label={`#${tagFilter}`} onPress={() => setTagFilter(null)} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
            onPress={() => {
              setFilter("all");
              setDateFilter("all");
              setTagFilter(null);
            }}
            style={s.clearFilters}
          >
            <Text style={[s.clearFiltersText, { color: theme.accent }]}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
      {groups.length ? (
        <View style={s.list}>
          {groups.map(({ document, passages }) => {
            const color = documentTypeColor(document.sourceName),
              noteCount = passages.filter((passage) => passage.note.trim()).length,
              savedCount = passages.length - noteCount;
            return (
              <ScrollFadeItem key={document.id}>
                <View style={[s.group, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${document.title} notebook`}
                    onPress={() => setNotebookId(document.id)}
                    style={({ pressed }) => [
                      s.groupHeader,
                      { backgroundColor: pressed ? theme.surfaceMuted : "transparent" },
                    ]}
                  >
                    <DocumentTypeIcon sourceName={document.sourceName} size={40} />
                    <View style={s.groupCopy}>
                      <Text numberOfLines={1} style={[s.documentTitle, { color: theme.text }]}>
                        {document.title}
                      </Text>
                      <Text style={[s.counts, { color: theme.mutedText }]}>
                        {noteCount} {noteCount === 1 ? "note" : "notes"} · {savedCount}{" "}
                        {savedCount === 1 ? "passage" : "passages"}
                      </Text>
                    </View>
                    {notebook ? (
                      <Ionicons name="book-outline" size={20} color={theme.accent} />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
                    )}
                  </Pressable>
                  {passages.map((passage) => (
                    <View key={passage.id} style={[s.noteRow, { borderTopColor: theme.border }]}>
                      <View
                        style={[s.accent, { backgroundColor: passage.note.trim() ? "#F59E0B" : color }]}
                      />
                      {selecting ? (
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked: selectedIds.includes(noteSelectionId(document.id, passage.id)),
                          }}
                          accessibilityLabel={`${selectedIds.includes(noteSelectionId(document.id, passage.id)) ? "Deselect" : "Select"} note from ${document.title}`}
                          onPress={() => toggleSelected(noteSelectionId(document.id, passage.id))}
                          style={s.selectionBox}
                        >
                          <Ionicons
                            name={
                              selectedIds.includes(noteSelectionId(document.id, passage.id))
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={23}
                            color={
                              selectedIds.includes(noteSelectionId(document.id, passage.id))
                                ? theme.accent
                                : theme.mutedText
                            }
                          />
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`View note from ${document.title}`}
                        onPress={() =>
                          selecting
                            ? toggleSelected(noteSelectionId(document.id, passage.id))
                            : setViewing({ document, passage })
                        }
                        style={({ pressed }) => [s.noteMain, { opacity: pressed ? 0.68 : 1 }]}
                      >
                        <Text style={[s.noteMeta, { color: theme.mutedText }]}>
                          {passage.note.trim() ? noteTypeLabel(passage.noteType) : "Saved passage"} ·{" "}
                          {dateLabel(passage.updatedAt)}
                          {passage.pinned ? " · Pinned" : ""}
                        </Text>
                        {passage.note.trim() ? (
                          <View style={s.noteTitleRow}>
                            <Text numberOfLines={1} style={[s.noteTitle, { color: theme.text }]}>
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
                        <Text numberOfLines={3} style={[s.noteText, { color: theme.text }]}>
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
                        accessibilityLabel={`More options for ${passage.note.trim() ? "note" : "saved passage"}`}
                        onPress={() => setMenuItem({ document, passage })}
                        style={s.more}
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color={theme.mutedText} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ScrollFadeItem>
            );
          })}
        </View>
      ) : (
        <View style={s.empty}>
          {!query ? (
            <NotesEmptyAnimation />
          ) : (
            <Ionicons name="search-outline" size={34} color={theme.mutedText} />
          )}
          <Text style={[s.emptyTitle, { color: theme.text }]}>{query ? "No matches" : "No notes yet"}</Text>
          <Text style={[s.emptyCopy, { color: theme.mutedText }]}>
            {query
              ? "Try another search or filter."
              : "Save a passage in the Reader and add a note. It will be organized here by document."}
          </Text>
        </View>
      )}

      <Modal
        visible={viewing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={s.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close note"
            onPress={() => setViewing(null)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={[s.editor, { backgroundColor: theme.surface }]}>
            <View style={[s.handle, { backgroundColor: theme.border }]} />
            <View style={s.editorHeader}>
              <View style={s.editorCopy}>
                <Text style={[s.editorTitle, { color: theme.text }]}>
                  {viewing?.passage.note.trim() ? "Note" : "Saved passage"}
                </Text>
                <Text numberOfLines={1} style={[s.editorDocument, { color: theme.mutedText }]}>
                  {viewing?.document.title} · {viewing ? dateLabel(viewing.passage.updatedAt) : ""}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close note"
                onPress={() => setViewing(null)}
                style={s.close}
              >
                <Ionicons name="close" size={23} color={theme.text} />
              </Pressable>
            </View>
            {viewing?.passage.note.trim() ? (
              <View style={[s.detailSource, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[s.detailLabel, { color: theme.accent }]}>YOUR NOTE</Text>
                <Text style={[s.detailNote, { color: theme.text }]}>{viewing.passage.note}</Text>
              </View>
            ) : (
              <View style={[s.detailSource, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[s.detailLabel, { color: theme.accent }]}>SAVED PASSAGE</Text>
                <Text style={[s.detailPassage, { color: theme.text }]}>{viewing?.passage.text}</Text>
              </View>
            )}
            {viewing?.passage.note.trim() ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ask Votic about this note"
                onPress={() => {
                  if (viewing) askAboutNotes(viewing.document.id, viewing.passage.id);
                }}
                style={({ pressed }) => [
                  s.readerButton,
                  { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={19} color={theme.accent} />
                <Text style={[s.readerButtonText, { color: theme.accent }]}>Ask Votic about this note</Text>
                <Ionicons name="arrow-forward" size={18} color={theme.accent} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open this passage in Reader"
              onPress={() => {
                if (!viewing) return;
                const selected = viewing;
                setViewing(null);
                open(selected.document.id, selected.passage.sentenceIndex);
              }}
              style={({ pressed }) => [
                s.readerButton,
                { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="book-outline" size={19} color={theme.accent} />
              <Text style={[s.readerButtonText, { color: theme.accent }]}>Open in Reader</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.accent} />
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={s.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            onPress={() => setFilterOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={[s.filterSheet, { backgroundColor: theme.surface }]}>
            <View style={[s.handle, { backgroundColor: theme.border }]} />
            <View style={s.filterSheetHeader}>
              <View style={s.editorCopy}>
                <Text accessibilityRole="header" style={[s.editorTitle, { color: theme.text }]}>
                  Filter Notes
                </Text>
                <Text style={[s.editorDocument, { color: theme.mutedText }]}>
                  Narrow your notes without crowding the workspace.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={() => setFilterOpen(false)}
                style={s.close}
              >
                <Ionicons name="close" size={23} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.filterSheetContent}>
              <FilterSection title="Type">
                <SheetChoice
                  label="Pinned"
                  selected={filter === "pinned"}
                  onPress={() => setFilter(filter === "pinned" ? "all" : "pinned")}
                />
                <SheetChoice
                  label="Key Points"
                  selected={filter === "key-point"}
                  onPress={() => setFilter(filter === "key-point" ? "all" : "key-point")}
                />
                <SheetChoice
                  label="Questions"
                  selected={filter === "question"}
                  onPress={() => setFilter(filter === "question" ? "all" : "question")}
                />
                <SheetChoice
                  label="Definitions"
                  selected={filter === "definition"}
                  onPress={() => setFilter(filter === "definition" ? "all" : "definition")}
                />
              </FilterSection>
              <FilterSection title="Date">
                <DateFilterButton label="Any time" value="all" current={dateFilter} onPress={setDateFilter} />
                <DateFilterButton label="Today" value="today" current={dateFilter} onPress={setDateFilter} />
                <DateFilterButton label="7 days" value="week" current={dateFilter} onPress={setDateFilter} />
                <DateFilterButton
                  label="30 days"
                  value="month"
                  current={dateFilter}
                  onPress={setDateFilter}
                />
              </FilterSection>
              {availableTags.length ? (
                <FilterSection title="Tags">
                  <TagFilterButton label="All tags" active={!tagFilter} onPress={() => setTagFilter(null)} />
                  {availableTags.map((tag) => (
                    <TagFilterButton
                      key={tag}
                      label={`#${tag}`}
                      active={tagFilter === tag}
                      onPress={() => setTagFilter(tagFilter === tag ? null : tag)}
                    />
                  ))}
                </FilterSection>
              ) : null}
            </ScrollView>
            <View style={s.filterSheetActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFilter("all");
                  setDateFilter("all");
                  setTagFilter(null);
                }}
                style={[s.resetFilters, { borderColor: theme.border }]}
              >
                <Text style={[s.resetFiltersText, { color: theme.text }]}>Reset</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilterOpen(false)}
                style={[s.showResults, { backgroundColor: theme.accent }]}
              >
                <Text style={s.showResultsText}>Show Results</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={menuItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuItem(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close note options"
          onPress={() => setMenuItem(null)}
          style={s.menuBackdrop}
        >
          <View accessibilityViewIsModal style={[s.menu, { backgroundColor: theme.surface }]}>
            <Text style={[s.menuTitle, { color: theme.text }]}>Note options</Text>
            <MenuAction
              icon="create-outline"
              label={menuItem?.passage.note.trim() ? "Edit note" : "Add a note"}
              onPress={() => {
                if (!menuItem) return;
                const selected = menuItem;
                setMenuItem(null);
                edit(selected.document, selected.passage);
              }}
            />
            <MenuAction
              icon={menuItem?.passage.pinned ? "pin" : "pin-outline"}
              label={menuItem?.passage.pinned ? "Unpin note" : "Pin note"}
              onPress={() => {
                if (!menuItem) return;
                const selected = menuItem;
                savePassage(selected.document.id, {
                  ...selected.passage,
                  pinned: !selected.passage.pinned,
                  updatedAt: Date.now(),
                });
                setMenuItem(null);
              }}
            />
            <MenuAction
              icon="book-outline"
              label="Open in Reader"
              onPress={() => {
                if (!menuItem) return;
                const selected = menuItem;
                setMenuItem(null);
                open(selected.document.id, selected.passage.sentenceIndex);
              }}
            />
            <MenuAction
              icon="share-outline"
              label="Share note"
              onPress={() => {
                if (!menuItem) return;
                const selected = menuItem;
                setMenuItem(null);
                void shareItems([selected], automaticNoteTitle(selected.passage));
              }}
            />
            <MenuAction icon="trash-outline" label="Remove from Notes" destructive onPress={remove} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setMenuItem(null)}
              style={[s.cancel, { borderColor: theme.border }]}
            >
              <Text style={[s.cancelText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close note editor"
            onPress={() => setEditing(null)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={[s.editor, { backgroundColor: theme.surface }]}>
            <View style={[s.handle, { backgroundColor: theme.border }]} />
            <View style={s.editorHeader}>
              <View style={s.editorCopy}>
                <Text style={[s.editorTitle, { color: theme.text }]}>
                  {editing?.passage.note.trim() ? "Edit note" : "Add a note"}
                </Text>
                <Text numberOfLines={1} style={[s.editorDocument, { color: theme.mutedText }]}>
                  {editing?.document.title}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close note editor"
                onPress={() => setEditing(null)}
                style={s.close}
              >
                <Ionicons name="close" size={23} color={theme.text} />
              </Pressable>
            </View>
            <Text
              numberOfLines={3}
              style={[s.excerpt, { color: theme.mutedText, backgroundColor: theme.surfaceMuted }]}
            >
              {editing?.passage.text}
            </Text>
            <TextInput
              accessibilityLabel="Note title"
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Title (optional — Votic can create one)"
              placeholderTextColor={theme.mutedText}
              maxLength={100}
              style={[
                s.titleInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
            />
            <View style={s.typeRow}>
              {NOTE_TYPES.map((item) => (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draftType === item.value }}
                  onPress={() => setDraftType(item.value)}
                  style={[
                    s.typeChip,
                    {
                      borderColor: draftType === item.value ? theme.accent : theme.border,
                      backgroundColor: draftType === item.value ? theme.sentenceHighlight : theme.surface,
                    },
                  ]}
                >
                  <Text
                    style={[s.typeChipText, { color: draftType === item.value ? theme.accent : theme.text }]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              accessibilityLabel="Note tags"
              value={draftTags}
              onChangeText={setDraftTags}
              placeholder="Tags, separated by commas"
              placeholderTextColor={theme.mutedText}
              maxLength={240}
              style={[
                s.titleInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
            />
            <TextInput
              autoFocus
              accessibilityLabel="Note text"
              value={draft}
              onChangeText={setDraft}
              placeholder="Write your note..."
              placeholderTextColor={theme.mutedText}
              multiline
              maxLength={2000}
              style={[
                s.noteInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save note"
              onPress={save}
              style={({ pressed }) => [
                s.save,
                { backgroundColor: theme.accent, opacity: pressed ? 0.78 : 1 },
              ]}
            >
              <Text style={s.saveText}>Save note</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function NotebookStat({ label, value }: { label: string; value: number }) {
  const { theme } = useVoticTheme();
  return (
    <View style={[s.notebookStat, { backgroundColor: theme.surfaceMuted }]}>
      <Text style={[s.notebookStatValue, { color: theme.text }]}>{value}</Text>
      <Text style={[s.notebookStatLabel, { color: theme.mutedText }]}>{label}</Text>
    </View>
  );
}
function NotebookAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.notebookAction, { borderColor: theme.border }]}
    >
      <Ionicons name={icon} size={17} color={theme.accent} />
      <Text style={[s.notebookActionText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
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
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.filterSection}>
      <Text style={[s.filterSectionTitle, { color: theme.text }]}>{title}</Text>
      <View style={s.filterSectionChoices}>{children}</View>
    </View>
  );
}
function SheetChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        s.compactFilter,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.sentenceHighlight : theme.surface,
        },
      ]}
    >
      <Text style={[s.compactFilterText, { color: selected ? theme.accent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}
function DateFilterButton({
  label,
  value,
  current,
  onPress,
}: {
  label: string;
  value: DateFilter;
  current: DateFilter;
  onPress: (value: DateFilter) => void;
}) {
  const { theme } = useVoticTheme();
  const active = value === current;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={() => onPress(value)}
      style={[
        s.compactFilter,
        {
          borderColor: active ? theme.accent : theme.border,
          backgroundColor: active ? theme.sentenceHighlight : theme.surface,
        },
      ]}
    >
      <Text style={[s.compactFilterText, { color: active ? theme.accent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}
function TagFilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        s.compactFilter,
        {
          borderColor: active ? theme.accent : theme.border,
          backgroundColor: active ? theme.sentenceHighlight : theme.surface,
        },
      ]}
    >
      <Text style={[s.compactFilterText, { color: active ? theme.accent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}
function FilterButton({
  label,
  value,
  current,
  onPress,
}: {
  label: string;
  value: Filter;
  current: Filter;
  onPress: (value: Filter) => void;
}) {
  const { theme } = useVoticTheme();
  const active = value === current;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={() => onPress(value)}
      style={[
        s.filter,
        {
          borderColor: active ? theme.accent : theme.border,
          backgroundColor: active ? theme.sentenceHighlight : theme.surface,
        },
      ]}
    >
      <Text style={[s.filterText, { color: active ? theme.accent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}
function MenuAction({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { theme } = useVoticTheme();
  const color = destructive ? "#DC2626" : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.menuAction,
        { backgroundColor: pressed ? theme.surfaceMuted : "transparent" },
      ]}
    >
      <Ionicons name={icon} size={21} color={color} />
      <Text style={[s.menuActionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  notebookHero: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
  notebookBack: {
    minHeight: 40,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  notebookBackText: { fontSize: 13, fontWeight: "800" },
  notebookHeading: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  notebookCopy: { flex: 1 },
  notebookTitle: { fontSize: 19, fontWeight: "800" },
  notebookAsk: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  notebookAskText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  notebookStats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  notebookStat: {
    minWidth: 74,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  notebookStatValue: { fontSize: 16, fontWeight: "800" },
  notebookStatLabel: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  notebookActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  notebookAction: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  notebookActionText: { fontSize: 12, fontWeight: "700" },
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
  selectionHeader: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  selectButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  selectButtonText: { fontSize: 13, fontWeight: "800" },
  selectedCount: { flex: 1, fontSize: 13, fontWeight: "700" },
  shareSelected: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  shareSelectedText: { fontSize: 13, fontWeight: "800" },
  askSelected: {
    minHeight: 38,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  askSelectedText: { color: "#FFF", fontSize: 13, fontWeight: "800" },
  selectionBox: { width: 36, alignItems: "center", justifyContent: "center" },
  primaryFilters: { flexDirection: "row", gap: spacing.xs },
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
  compactFilter: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  compactFilterText: { fontSize: 12, fontWeight: "700" },
  filter: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: { fontSize: 12, fontWeight: "700" },
  filterSheet: {
    maxHeight: "78%",
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  filterSheetHeader: { flexDirection: "row", alignItems: "center" },
  filterSheetContent: { gap: spacing.lg, paddingBottom: spacing.sm },
  filterSection: { gap: spacing.sm },
  filterSectionTitle: { fontSize: 14, fontWeight: "800" },
  filterSectionChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filterSheetActions: { flexDirection: "row", gap: spacing.sm },
  resetFilters: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  resetFiltersText: { fontSize: 14, fontWeight: "800" },
  showResults: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  showResultsText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  list: { gap: spacing.md },
  group: { borderWidth: 1, borderRadius: radii.lg, overflow: "hidden" },
  groupHeader: {
    minHeight: 66,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  docIcon: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  groupCopy: { flex: 1 },
  askButton: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  askButtonText: { fontSize: 12, fontWeight: "800" },
  documentTitle: { fontSize: 15, fontWeight: "800" },
  counts: { fontSize: 12, marginTop: 3 },
  noteRow: {
    minHeight: 94,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
  },
  accent: { width: 3, borderRadius: 2, marginVertical: 3, marginRight: spacing.sm },
  noteMain: { flex: 1, justifyContent: "center", gap: 5 },
  noteMeta: { fontSize: 12, fontWeight: "600" },
  noteTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  noteTitle: { fontSize: 15, fontWeight: "800", flexShrink: 1 },
  voticBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  voticBadgeText: { fontSize: 10, fontWeight: "800" },
  noteText: { fontSize: 14, lineHeight: 20 },
  tags: { fontSize: 12, fontWeight: "700" },
  more: {
    width: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  empty: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  emptyTitle: { ...typography.sectionTitle },
  emptyCopy: { ...typography.body, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.3)", justifyContent: "flex-end" },
  editor: {
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center" },
  editorHeader: { flexDirection: "row", alignItems: "center" },
  editorCopy: { flex: 1 },
  editorTitle: { ...typography.sheetTitle },
  editorDocument: { fontSize: 13, marginTop: 2 },
  close: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  excerpt: { borderRadius: radii.md, padding: spacing.md, fontSize: 13, lineHeight: 19 },
  titleInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  typeChip: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  typeChipText: { fontSize: 12, fontWeight: "700" },
  noteInput: {
    minHeight: 130,
    maxHeight: 260,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: "top",
  },
  save: { minHeight: 50, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  detailNote: { fontSize: 18, lineHeight: 27, fontWeight: "600" },
  detailSource: { borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  detailLabel: { ...typography.eyebrow, fontSize: 11 },
  detailPassage: { fontSize: 15, lineHeight: 23 },
  readerButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  readerButtonText: { ...typography.control, flex: 1, textAlign: "center" },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.3)",
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  menu: { borderRadius: radii.lg, padding: spacing.md, gap: 2 },
  menuTitle: { ...typography.sectionTitle, padding: spacing.sm },
  menuAction: {
    minHeight: 52,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  menuActionText: { fontSize: 16, fontWeight: "700" },
  cancel: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  cancelText: { fontSize: 16, fontWeight: "700" },
});
