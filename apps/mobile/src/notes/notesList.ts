import { SavedPassage, VoticDocument } from "../documents/types";
import { automaticNoteTitle, noteTypeLabel } from "./noteMetadata";

export type NotesFilter = "all" | "notes" | "saved" | "pinned" | "key-point" | "question" | "definition";
export type DateFilter = "all" | "today" | "week" | "month";
export type NoteItem = { document: VoticDocument; passage: SavedPassage };
export type NotesView = {
  query: string;
  filter: NotesFilter;
  dateFilter: DateFilter;
  tagFilter: string | null;
  notebookId: string | null;
};

const TYPE_FILTERS: NotesFilter[] = ["key-point", "question", "definition"];
const DATE_LIMITS_MS = { today: 86_400_000, week: 604_800_000, month: 2_592_000_000 } as const;

/** Every filter except the default (all notes) lives in the filter sheet and shows as a removable chip. */
export function isAdvancedFilter(filter: NotesFilter) {
  return filter !== "all";
}

export function advancedFilterCount(view: Pick<NotesView, "filter" | "dateFilter" | "tagFilter">) {
  return (
    Number(isAdvancedFilter(view.filter)) +
    Number(view.dateFilter !== "all") +
    Number(Boolean(view.tagFilter))
  );
}

export function dateFilterLabel(dateFilter: Exclude<DateFilter, "all">) {
  return dateFilter === "today" ? "Today" : dateFilter === "week" ? "Last 7 days" : "Last 30 days";
}

export function availableTags(documents: VoticDocument[]) {
  return [
    ...new Set(
      documents.flatMap((document) =>
        (document.savedPassages || []).flatMap((passage) => passage.tags || []),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function matches(document: VoticDocument, passage: SavedPassage, view: NotesView, now: number) {
  const hasNote = Boolean(passage.note.trim());
  if (view.notebookId && document.id !== view.notebookId) return false;
  if (view.filter === "notes" && !hasNote) return false;
  if (view.filter === "saved" && hasNote) return false;
  if (view.filter === "pinned" && !passage.pinned) return false;
  if (TYPE_FILTERS.includes(view.filter) && (passage.noteType || "note") !== view.filter) return false;
  if (view.tagFilter && !(passage.tags || []).includes(view.tagFilter)) return false;
  if (view.dateFilter !== "all" && now - passage.updatedAt > DATE_LIMITS_MS[view.dateFilter]) return false;
  const needle = view.query.trim().toLocaleLowerCase();
  if (!needle) return true;
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
  return searchable.includes(needle);
}

/**
 * Saved passages matching the view, grouped by document, most recently updated first.
 * Inside a notebook, pinned notes come first.
 */
export function noteGroups(documents: VoticDocument[], view: NotesView, now = Date.now()) {
  return documents
    .map((document) => {
      const passages = (document.savedPassages || [])
        .filter((passage) => matches(document, passage, view, now))
        .sort((a, b) =>
          view.notebookId
            ? Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt
            : b.updatedAt - a.updatedAt,
        );
      return { document, passages };
    })
    .filter((group) => group.passages.length)
    .sort((a, b) => b.passages[0].updatedAt - a.passages[0].updatedAt);
}

export function shareText(items: NoteItem[], title: string) {
  const body = items
    .map(({ document, passage }, index) => {
      const tags = passage.tags?.length ? `\nTags: ${passage.tags.map((tag) => `#${tag}`).join(" ")}` : "";
      return `${index + 1}. ${automaticNoteTitle(passage)}\n${passage.note.trim() || passage.text}\nSource: ${document.title}${tags}`;
    })
    .join("\n\n");
  return `${title}\n\n${body}\n\nShared from Votic`;
}

export function dateLabel(value: number, today = new Date()) {
  const date = new Date(value);
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
