import { resolve_file_type, strip_file_extension } from "./fileTypes";
import { estimated_minutes_remaining } from "./insights";
import { split_passages } from "./passages";
import { VoticDocument } from "./types";

/**
 * A readable title for display. Filenames like "q3_board-report_FINAL.pdf" become "q3 board report
 * FINAL"; titles that already read as words are left alone. The original filename stays available.
 */
export function readable_title(title: string) {
  // Older imports kept ".pdf" and similar in the title, which then read as a word ("sample pdf").
  const trimmed = strip_file_extension(title);
  const looksLikeFilename = /[_]/.test(trimmed) || (!/\s/.test(trimmed) && /[-.]/.test(trimmed));
  const clean = looksLikeFilename ? trimmed.replace(/[_]+/g, " ").replace(/(\w)[-.](?=\w)/g, "$1 ") : trimmed;
  return clean.replace(/\s+/g, " ").trim() || "Untitled document";
}

/** The readable title of a document that may not be open yet, or `fallback` until one is. */
export function document_heading(document: { title: string } | null | undefined, fallback: string) {
  return document ? readable_title(document.title) : fallback;
}

export function file_type_label(sourceName: string) {
  return resolve_file_type({ filename: sourceName }).label;
}

/** What a document is, as people know it: imported webpages and camera scans are saved as text, but aren't "Text". */
export function document_type_label(document: Pick<VoticDocument, "sourceName" | "origin" | "sourceUrl">) {
  // Webpages imported before the origin was recorded still have the address they came from.
  if (document.origin === "webpage" || (!document.origin && document.sourceUrl)) return "Webpage";
  if (document.origin === "scan") return "Scan";
  return file_type_label(document.sourceName);
}

/** "Passage 12 of 80" from the saved reading position. */
export function position_label(document: VoticDocument) {
  const total = split_passages(document.plainText).length;
  if (!total) return "Empty document";
  return `Passage ${Math.min(total, document.sentenceIndex + 1)} of ${total}`;
}

export function progress_label(document: VoticDocument) {
  if (document.progress >= 1) return "Finished";
  if (!document.progress) return "Not started";
  const minutes = estimated_minutes_remaining(document);
  return `${Math.round(document.progress * 100)}% · about ${minutes} min left`;
}

export type Sort = "recent" | "added" | "title" | "progress";
export const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recently opened" },
  { value: "added", label: "Recently added" },
  { value: "title", label: "Title" },
  { value: "progress", label: "Progress" },
];

export function sort_documents(documents: VoticDocument[], sort: Sort) {
  const sorted = [...documents];
  if (sort === "added") return sorted.sort((a, b) => b.importedAt - a.importedAt);
  if (sort === "title")
    return sorted.sort((a, b) => readable_title(a.title).localeCompare(readable_title(b.title)));
  if (sort === "progress") return sorted.sort((a, b) => b.progress - a.progress);
  return sorted.sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt));
}

/** The label and active-filter count shared by the library heading and its filter controls. */
export function collection_summary(collection: string, sort: Sort, finishedOnly: boolean) {
  return {
    filterCount: (collection !== "all" ? 1 : 0) + (sort !== "recent" ? 1 : 0) + (finishedOnly ? 1 : 0),
    collectionLabel:
      collection === "all" ? "All documents" : collection === "unfiled" ? "Unfiled" : collection,
  };
}
