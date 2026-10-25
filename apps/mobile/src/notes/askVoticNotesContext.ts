import { SavedPassage, VoticDocument } from "../documents/types";
import { note_type_label } from "./noteMetadata";

export type NotesAskScope = { documentId?: string; passageId?: string; passageIds?: string[] };
export type NotesAskItem = { document: VoticDocument; passage: SavedPassage };

// Reader passage ids ("passage-<sentence>") repeat across documents, so selections must include the document id.
const SELECTION_SEPARATOR = "::";
export function note_selection_id(documentId: string, passageId: string) {
  return `${documentId}${SELECTION_SEPARATOR}${passageId}`;
}

export function notes_for_ask_votic(documents: VoticDocument[], scope: NotesAskScope): NotesAskItem[] {
  const selected = scope.documentId
    ? documents.filter((document) => document.id === scope.documentId)
    : documents;
  return selected.flatMap((document) =>
    (document.savedPassages || [])
      .filter((passage) => !scope.passageId || passage.id === scope.passageId)
      .filter(
        (passage) =>
          !scope.passageIds?.length || scope.passageIds.includes(note_selection_id(document.id, passage.id)),
      )
      .filter((passage) => Boolean(passage.note.trim() || passage.text.trim()))
      .map((passage) => ({ document, passage })),
  );
}

function location_label({ document, passage }: NotesAskItem) {
  return passage.text.trim()
    ? `Location: passage ${passage.sentenceIndex + 1} of ${document.title}`
    : `Notebook: ${document.title}`;
}

/** What the person set on the note besides its text (title, type, pin, tags), so questions about them can be answered. */
function details_line(passage: SavedPassage) {
  const parts = [
    passage.title?.trim() ? `Title: ${passage.title.trim()}` : "",
    passage.noteType ? `Type: ${note_type_label(passage.noteType)}` : "",
    passage.pinned ? "Pinned" : "",
    passage.tags?.length ? `Tags: ${passage.tags.map((tag) => `#${tag.replace(/^#+/, "")}`).join(" ")}` : "",
  ].filter(Boolean);
  return parts.length ? `${parts.join(" · ")}\n` : "";
}

/** Notes as Ask Votic sections, each linked to the Reader location it came from. */
export function build_notes_ask_sections(documents: VoticDocument[], scope: NotesAskScope) {
  const notes = notes_for_ask_votic(documents, scope);
  if (!notes.length) return undefined;
  const oneDocument = scope.documentId ? notes[0]?.document : undefined;
  return {
    title: oneDocument ? `Notes from ${oneDocument.title}` : "My Votic notes",
    sections: notes.map((item, index) => {
      const { document, passage } = item;
      const note = passage.note.trim();
      const section = note
        ? {
            heading: `Note ${index + 1} — ${document.title}`,
            text: `${details_line(passage)}My note: ${note}\nSource passage: ${passage.text}\n${location_label(item)}`,
          }
        : {
            heading: `Saved passage ${index + 1} — ${document.title}`,
            text: `${details_line(passage)}Saved passage: ${passage.text.trim()}\n${location_label(item)}`,
          };
      return { section, link: { documentId: document.id, sentenceIndex: passage.sentenceIndex } };
    }),
  };
}

export function build_notes_ask_document(documents: VoticDocument[], scope: NotesAskScope) {
  const notes = build_notes_ask_sections(documents, scope);
  return notes && { title: notes.title, sections: notes.sections.map((item) => item.section) };
}

export function notes_ask_scope_label(documents: VoticDocument[], scope: NotesAskScope) {
  const notes = notes_for_ask_votic(documents, scope);
  if (!notes.length) return "";
  if (scope.passageId) return `Asking about: 1 note · ${notes[0].document.title}`;
  if (scope.passageIds?.length)
    return `Asking about: ${notes.length} selected ${notes.length === 1 ? "note" : "notes"}`;
  if (scope.documentId)
    return `Asking about: ${notes[0].document.title} · ${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
  return `Asking about: All notes · ${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
}
