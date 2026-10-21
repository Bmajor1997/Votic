import { readable_documents, type VoticDocument } from "../documents/types";

/** A short scan or note doesn't need a summary: the end card skips it below this many passages. */
export const MIN_PASSAGES_TO_SUMMARIZE = 4;
/** The same request as the "Summarize this document" suggestion in Ask Votic. */
export const FINISH_SUMMARY_QUESTION = "Summarize this document";

/**
 * Finished means read to the end and still there. Reopening a finished document and going back to the start lowers
 * its progress, so it moves back to "in progress" without its finish date being erased.
 */
export function is_finished(document: Pick<VoticDocument, "completedAt" | "progress">) {
  return Boolean(document.completedAt) && document.progress >= 0.999;
}

/**
 * What to read after finishing `currentId`: the unfinished document opened most recently, or else the newest one not
 * started yet. Null when everything else is finished (or there is nothing else).
 */
export function next_up(documents: VoticDocument[], currentId?: string | null): VoticDocument | null {
  const candidates = readable_documents(documents).filter(
    (document) => document.id !== currentId && !is_finished(document),
  );
  const started = candidates
    .filter((document) => document.progress > 0)
    .sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt));
  if (started[0]) return started[0];
  return [...candidates].sort((a, b) => b.importedAt - a.importedAt)[0] ?? null;
}
