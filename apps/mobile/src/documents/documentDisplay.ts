import { estimatedMinutesRemaining } from "./insights";
import { splitPassages } from "./passages";
import { VoticDocument } from "./types";

/**
 * A readable title for display. Filenames like "q3_board-report_FINAL" become "q3 board report
 * FINAL"; titles that already read as words are left alone. The original filename stays available.
 */
export function readableTitle(title: string) {
  const trimmed = title.trim();
  const looksLikeFilename = /[_]/.test(trimmed) || (!/\s/.test(trimmed) && /[-.]/.test(trimmed));
  const clean = looksLikeFilename ? trimmed.replace(/[_]+/g, " ").replace(/(\w)[-.](?=\w)/g, "$1 ") : trimmed;
  return clean.replace(/\s+/g, " ").trim() || "Untitled document";
}

export function fileTypeLabel(sourceName: string) {
  const name = sourceName.toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (/\.docx?$/.test(name)) return "Word";
  if (/\.pptx?$/.test(name)) return "PowerPoint";
  if (name.endsWith(".epub")) return "EPUB";
  if (name.endsWith(".md")) return "Markdown";
  return "Text";
}

/** "Passage 12 of 80" from the saved reading position. */
export function positionLabel(document: VoticDocument) {
  const total = splitPassages(document.plainText).length;
  if (!total) return "Empty document";
  return `Passage ${Math.min(total, document.sentenceIndex + 1)} of ${total}`;
}

export function progressLabel(document: VoticDocument) {
  if (document.progress >= 1) return "Finished";
  if (!document.progress) return "Not started";
  const minutes = estimatedMinutesRemaining(document);
  return `${Math.round(document.progress * 100)}% · about ${minutes} min left`;
}

/** The first few words of the document, used for its text cover. */
export function coverExcerpt(document: VoticDocument, words = 28) {
  return document.plainText
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, words)
    .join(" ");
}

export type Sort = "recent" | "added" | "title" | "progress";
export const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recently opened" },
  { value: "added", label: "Recently added" },
  { value: "title", label: "Title" },
  { value: "progress", label: "Progress" },
];

export function sortDocuments(documents: VoticDocument[], sort: Sort) {
  const sorted = [...documents];
  if (sort === "added") return sorted.sort((a, b) => b.importedAt - a.importedAt);
  if (sort === "title")
    return sorted.sort((a, b) => readableTitle(a.title).localeCompare(readableTitle(b.title)));
  if (sort === "progress") return sorted.sort((a, b) => b.progress - a.progress);
  return sorted.sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt));
}
