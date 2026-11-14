import { useState } from "react";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { NoteEditor } from "./components/NoteEditor";
import { new_quick_note_item, note_from_draft } from "./noteDraft";
import type { NoteItem } from "./notesList";

/** The same manual editor and Quick Notes notebook used by the Notes tab. */
export function useQuickNoteEditor() {
  const { add_quick_note } = useDocumentLibrary();
  const [item, setItem] = useState<NoteItem | null>(null);
  function open_quick_note() {
    setItem(new_quick_note_item());
  }
  return {
    open_quick_note,
    editor: (
      <NoteEditor
        item={item}
        on_close={() => setItem(null)}
        on_save={({ passage }, draft) => {
          if (!draft.note.trim()) return;
          if (!add_quick_note(note_from_draft(passage, draft))) throw new Error("Free note limit reached");
          setItem(null);
        }}
      />
    ),
  };
}
