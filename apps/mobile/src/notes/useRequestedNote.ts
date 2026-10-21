import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { NoteItem } from "./notesList";

/** A note by its stable ID, preferring the notebook it was opened from. Null when it no longer exists. */
export function find_note(
  documents: NoteItem["document"][],
  noteId: string,
  notebookId: string | null,
): NoteItem | null {
  const owners = notebookId ? documents.filter((document) => document.id === notebookId) : documents;
  for (const document of owners) {
    const passage = document.savedPassages?.find((item) => item.id === noteId);
    if (passage) return { document, passage };
  }
  return null;
}

/**
 * Opens the note a link asked for (Home passes `note` and `notebook` IDs), once the library has loaded, so a Quick
 * Note shows that note rather than the whole notebook. Returns true when the note no longer exists.
 */
export function useRequestedNote(
  documents: NoteItem["document"][],
  loaded: boolean,
  open: (item: NoteItem) => void,
) {
  const params = useLocalSearchParams<{ note?: string; notebook?: string }>();
  const noteId = typeof params.note === "string" ? params.note : null;
  const notebookId = typeof params.notebook === "string" ? params.notebook : null;
  const [handled, setHandled] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  // Adjusting state while rendering, React's pattern for responding to a new input without an extra effect pass.
  if (noteId && loaded && handled !== noteId) {
    setHandled(noteId);
    const target = find_note(documents, noteId, notebookId);
    setMissing(!target);
    if (target) open(target);
  }
  useEffect(() => {
    // Consumed: going back to Notes later shows the list, not this note again.
    if (noteId && handled === noteId) router.setParams({ note: undefined, notebook: undefined });
  }, [noteId, handled]);
  return missing;
}
