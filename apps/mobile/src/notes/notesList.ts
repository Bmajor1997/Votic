import { SavedPassage, VoticDocument } from "../documents/types";
import { automatic_note_title, note_type_label } from "./noteMetadata";

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
export function is_advanced_filter(filter: NotesFilter) {
  return filter !== "all";
}

export function advanced_filter_count(view: Pick<NotesView, "filter" | "dateFilter" | "tagFilter">) {
  return (
    Number(is_advanced_filter(view.filter)) +
    Number(view.dateFilter !== "all") +
    Number(Boolean(view.tagFilter))
  );
}

export function date_filter_label(dateFilter: Exclude<DateFilter, "all">) {
  return dateFilter === "today" ? "Today" : dateFilter === "week" ? "Last 7 days" : "Last 30 days";
}

export function available_tags(documents: VoticDocument[]) {
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
    note_type_label(passage.noteType),
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
export function note_groups(documents: VoticDocument[], view: NotesView, now = Date.now()) {
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

/**
 * "3 notes · 2 saved passages in 2 notebooks". A saved passage without anything written is not a note,
 * so the two are counted apart, as on each notebook.
 */
export function notes_summary(groups: { passages: Pick<SavedPassage, "note">[] }[]) {
  const passages = groups.flatMap((group) => group.passages);
  if (!passages.length) return "No matching notes";
  const notes = passages.filter((passage) => passage.note.trim()).length;
  const saved = passages.length - notes;
  const parts = [
    notes ? `${notes} ${notes === 1 ? "note" : "notes"}` : "",
    saved ? `${saved} saved ${saved === 1 ? "passage" : "passages"}` : "",
  ].filter(Boolean);
  return `${parts.join(" · ")} in ${groups.length} ${groups.length === 1 ? "notebook" : "notebooks"}`;
}

export function share_text(items: NoteItem[], title: string) {
  const body = items
    .map(({ document, passage }, index) => {
      const tags = passage.tags?.length ? `\nTags: ${passage.tags.map((tag) => `#${tag}`).join(" ")}` : "";
      return `${index + 1}. ${automatic_note_title(passage)}\n${passage.note.trim() || passage.text}\nSource: ${document.title}${tags}`;
    })
    .join("\n\n");
  return `${title}\n\n${body}\n\nShared from Votic`;
}

export function date_label(value: number, today = new Date()) {
  const date = new Date(value);
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
