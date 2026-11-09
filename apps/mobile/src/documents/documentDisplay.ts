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

export type DocumentTypeFilter = "all" | "pdf" | "word" | "text" | "other";
/** File types only: webpages, scans, Markdown, EPUB and the rest are under Other. */
export const DOCUMENT_TYPE_FILTERS: { value: DocumentTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pdf", label: "PDF" },
  { value: "word", label: "DOCX" },
  { value: "text", label: "TXT" },
  { value: "other", label: "Other" },
];

const FILTER_BY_EXTENSION: Record<string, DocumentTypeFilter> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  txt: "text",
};

/**
 * Which file type chip a document belongs to. Webpages and camera scans are saved as text files but aren't
 * files the person chose, so they're under Other.
 */
export function document_type_filter(
  document: Pick<VoticDocument, "sourceName" | "origin" | "sourceUrl">,
): DocumentTypeFilter {
  if (document.origin === "webpage" || document.origin === "scan" || (!document.origin && document.sourceUrl))
    return "other";
  const extension = resolve_file_type({ filename: document.sourceName }).extension;
  return FILTER_BY_EXTENSION[extension] ?? "other";
}

/** What a filter's documents are called in a sentence: "No PDFs match “moon”". */
const FILTER_NOUNS: Record<DocumentTypeFilter, string> = {
  all: "documents",
  pdf: "PDFs",
  word: "DOCX files",
  text: "TXT files",
  other: "other documents",
};
const FILTER_NOUN: Record<DocumentTypeFilter, string> = {
  all: "document",
  pdf: "PDF",
  word: "DOCX file",
  text: "TXT file",
  other: "other document",
};

/** The filter's documents in a sentence, singular for exactly one. */
export function type_filter_noun(filter: DocumentTypeFilter, count = 2) {
  return count === 1 ? FILTER_NOUN[filter] : FILTER_NOUNS[filter];
}

/** The heading shown when the current search, type, shelf and collection leave nothing to show. */
export function empty_filter_message({
  query,
  typeFilter,
  finishedOnly,
  collectionLabel,
}: {
  query: string;
  typeFilter: DocumentTypeFilter;
  finishedOnly: boolean;
  collectionLabel: string;
}) {
  const noun = type_filter_noun(typeFilter);
  if (query.trim()) return `No ${noun} match “${query.trim()}”`;
  if (typeFilter !== "all") return `No ${noun} here yet`;
  return finishedOnly ? "No finished documents yet" : `Nothing in ${collectionLabel} yet`;
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

export type Sort = "type" | "recent" | "added" | "title" | "progress";
export const SORTS: { value: Sort; label: string }[] = [
  { value: "type", label: "File type · Newest first" },
  { value: "recent", label: "Recently opened" },
  { value: "added", label: "Recently added" },
  { value: "title", label: "Title" },
  { value: "progress", label: "Progress" },
];

export function sort_documents(documents: VoticDocument[], sort: Sort) {
  const sorted = [...documents];
  if (sort === "type")
    return sorted.sort((a, b) => {
      const aType = document_type_label(a);
      const bType = document_type_label(b);
      const rank = (type: string) => (type === "PDF" ? 0 : type === "HTML" ? 1 : 2);
      return (
        rank(aType) - rank(bType) ||
        aType.localeCompare(bType) ||
        (b.importedAt || 0) - (a.importedAt || 0) ||
        a.sourceName.localeCompare(b.sourceName, undefined, { sensitivity: "base", numeric: true }) ||
        a.id.localeCompare(b.id)
      );
    });
  if (sort === "added") return sorted.sort((a, b) => b.importedAt - a.importedAt);
  if (sort === "title")
    return sorted.sort((a, b) => readable_title(a.title).localeCompare(readable_title(b.title)));
  if (sort === "progress") return sorted.sort((a, b) => b.progress - a.progress);
  return sorted.sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt));
}

/** The label and active-filter count shared by the library heading and its filter controls. */
export function collection_summary(collection: string, sort: Sort, finishedOnly: boolean) {
  return {
    filterCount: (collection !== "all" ? 1 : 0) + (sort !== "type" ? 1 : 0) + (finishedOnly ? 1 : 0),
    collectionLabel:
      collection === "all" ? "All documents" : collection === "unfiled" ? "Unfiled" : collection,
  };
}
