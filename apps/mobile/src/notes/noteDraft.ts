import type { SavedPassage, VoticDocument } from "../documents/types";
import type { NoteDraft } from "./components/NoteEditor";
import { clean_tags } from "./noteMetadata";
import type { NoteItem } from "./notesList";

/** The same draft for a standalone Quick Note or a note inside an existing notebook. */
export function new_quick_note_item(notebook?: VoticDocument): NoteItem {
  const now = Date.now();
  return {
    document: notebook ?? {
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
  };
}

export function note_from_draft(passage: SavedPassage, draft: NoteDraft): SavedPassage {
  return {
    ...passage,
    note: draft.note.trim(),
    title: draft.title.trim() || undefined,
    noteType: draft.noteType,
    tags: clean_tags(draft.tags),
    updatedAt: Date.now(),
  };
}
