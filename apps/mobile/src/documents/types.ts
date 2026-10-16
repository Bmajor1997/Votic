export type DailyReadingActivity = { readingSeconds: number; listeningSeconds: number };
export type NoteType = "note" | "key-point" | "question" | "definition";
export type SavedPassage = {
  id: string;
  sentenceIndex: number;
  text: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  title?: string;
  noteType?: NoteType;
  pinned?: boolean;
  tags?: string[];
};
/** How a document came into Votic. Documents added before this was recorded have none. */
export type DocumentOrigin = "file" | "webpage" | "scan" | "guide";
export type VoticDocument = {
  id: string;
  title: string;
  sourceName: string;
  origin?: DocumentOrigin;
  notebookKind?: "quick-notes";
  plainText: string;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  completedAt?: number;
  collection?: string;
  progress: number;
  sentenceIndex: number;
  wordIndex: number;
  playbackRate: number;
  activity?: Record<string, DailyReadingActivity>;
  savedPassages?: SavedPassage[];
  reviewResponses?: Record<string, string>;
};

/** Documents to read or listen to. Quick Notes is a notebook, so it stays out of the library and Home. */
export function readable_documents<T extends Pick<VoticDocument, "notebookKind">>(documents: T[]) {
  return documents.filter((document) => !document.notebookKind);
}
