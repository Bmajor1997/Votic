import { useState } from "react";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { NoteEditor } from "./components/NoteEditor";
import { clean_tags } from "./noteMetadata";
import type { NoteItem } from "./notesList";

/** The same manual editor and Quick Notes notebook used by the Notes tab. */
export function useQuickNoteEditor() {
  const { addQuickNote } = useDocumentLibrary();
  const [item, setItem] = useState<NoteItem | null>(null);
  function openQuickNote() {
    const now = Date.now();
    setItem({
      document: {
        id: "new-quick-note",
        title: "Quick Notes",
        sourceName: "Quick Notes.txt",
        plainText: "",
        importedAt: now,
        updatedAt: now,
        progress: 0,
        sentenceIndex: 0,
        wordIndex: 0,
        playbackRate: 1,
      },
      passage: {
        id: `quick-${now}-${Math.random().toString(36).slice(2, 8)}`,
        sentenceIndex: 0,
        text: "",
        note: "",
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  return {
    openQuickNote,
    editor: (
      <NoteEditor
        item={item}
        onClose={() => setItem(null)}
        onSave={({ passage }, draft) => {
          if (!draft.note.trim()) return;
          addQuickNote({
            ...passage,
            note: draft.note.trim(),
            title: draft.title.trim() || undefined,
            noteType: draft.noteType,
            tags: clean_tags(draft.tags),
            updatedAt: Date.now(),
          });
          setItem(null);
        }}
      />
    ),
  };
}
