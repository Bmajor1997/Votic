import { VOTIC_GUIDE_SOURCE_NAME } from "../onboarding/voticGuide";
import type { DocumentOrigin, VoticDocument } from "../documents/types";
import type { DocumentTime } from "./activityModel";

export type SourceKind = DocumentOrigin | "earlier";
export type SourceTime = {
  kind: SourceKind;
  label: string;
  reading: number;
  listening: number;
  total: number;
  documents: number;
};

export const SOURCE_LABELS: Record<SourceKind, string> = {
  file: "Uploaded files",
  webpage: "Webpages",
  scan: "Scans and photos",
  guide: "Votic guide",
  earlier: "Earlier documents",
};
/** How each source reads inside a sentence such as "Most of your time was with webpages". */
export const SOURCE_PHRASES: Record<SourceKind, string> = {
  file: "uploaded files",
  webpage: "webpages",
  scan: "scans and photos",
  guide: "the Votic guide",
  earlier: "earlier documents",
};
const ORDER: SourceKind[] = ["file", "webpage", "scan", "guide", "earlier"];

/**
 * Where a document came from. Newer documents record it; for older ones it is worked out only when the name
 * leaves no doubt (a camera scan, the guide, or a file type that can only have been uploaded). A plain text name
 * could be an uploaded text file or an imported webpage, so it is counted as "earlier" rather than guessed.
 */
export function document_origin(document: Pick<VoticDocument, "origin" | "sourceName">): SourceKind {
  if (document.origin) return document.origin;
  const name = document.sourceName || "";
  if (/^Scanned document - /.test(name) || /\.(jpe?g|png|webp)$/i.test(name)) return "scan";
  if (name === VOTIC_GUIDE_SOURCE_NAME) return "guide";
  if (/\.(pdf|docx|pptx|ppt|epub|rtf|odt|html?|md)$/i.test(name)) return "file";
  return "earlier";
}

/** Reading and listening time grouped by where the documents came from, largest first. */
export function source_breakdown(
  ranking: DocumentTime[],
  documents: Pick<VoticDocument, "id" | "origin" | "sourceName">[],
): SourceTime[] {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const totals = new Map<SourceKind, SourceTime>();
  for (const entry of ranking) {
    const document = byId.get(entry.documentId);
    // Time for a document that has since been removed has no known source.
    const kind = document ? document_origin(document) : "earlier";
    const current = totals.get(kind) ?? {
      kind,
      label: SOURCE_LABELS[kind],
      reading: 0,
      listening: 0,
      total: 0,
      documents: 0,
    };
    current.reading += entry.reading;
    current.listening += entry.listening;
    current.total += entry.total;
    current.documents += 1;
    totals.set(kind, current);
  }
  return [...totals.values()].sort(
    (a, b) => b.total - a.total || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind),
  );
}
