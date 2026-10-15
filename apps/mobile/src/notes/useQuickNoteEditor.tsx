import { useState } from "react";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { NoteEditor } from "./components/NoteEditor";
import { new_quick_note_item, note_from_draft } from "./noteDraft";
import type { NoteItem } from "./notesList";

/** The same manual editor and Quick Notes notebook used by the Notes tab. */
export function useQuickNoteEditor() {
  const { addQuickNote } = useDocumentLibrary();
  const [item, setItem] = useState<NoteItem | null>(null);
  function openQuickNote() {
    setItem(new_quick_note_item());
  }
  return {
    openQuickNote,
    editor: (
      <NoteEditor
        item={item}
        onClose={() => setItem(null)}
        onSave={({ passage }, draft) => {
          if (!draft.note.trim()) return;
          addQuickNote(note_from_draft(passage, draft));
          setItem(null);
        }}
      />
    ),
  };
}
