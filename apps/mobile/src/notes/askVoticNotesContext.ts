import { SavedPassage, VoticDocument } from "../documents/types";

export type NotesAskScope = { documentId?: string; passageId?: string; passageIds?: string[] };
export type NotesAskItem = { document: VoticDocument; passage: SavedPassage };

// Reader passage ids ("passage-<sentence>") repeat across documents, so selections must include the document id.
const SELECTION_SEPARATOR = "::";
export function noteSelectionId(documentId: string, passageId: string) {
  return `${documentId}${SELECTION_SEPARATOR}${passageId}`;
}

export function notesForAskVotic(documents: VoticDocument[], scope: NotesAskScope): NotesAskItem[] {
  const selected = scope.documentId
    ? documents.filter((document) => document.id === scope.documentId)
    : documents;
  return selected.flatMap((document) =>
    (document.savedPassages || [])
      .filter((passage) => !scope.passageId || passage.id === scope.passageId)
      .filter(
        (passage) =>
          !scope.passageIds?.length || scope.passageIds.includes(noteSelectionId(document.id, passage.id)),
      )
      .filter((passage) => Boolean(passage.note.trim() || passage.text.trim()))
      .map((passage) => ({ document, passage })),
  );
}

function locationLabel({ document, passage }: NotesAskItem) {
  return passage.text.trim()
    ? `Location: passage ${passage.sentenceIndex + 1} of ${document.title}`
    : `Notebook: ${document.title}`;
}

/** Notes as Ask Votic sections, each linked to the Reader location it came from. */
export function buildNotesAskSections(documents: VoticDocument[], scope: NotesAskScope) {
  const notes = notesForAskVotic(documents, scope);
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
            text: `My note: ${note}\nSource passage: ${passage.text}\n${locationLabel(item)}`,
          }
        : {
            heading: `Saved passage ${index + 1} — ${document.title}`,
            text: `Saved passage: ${passage.text.trim()}\n${locationLabel(item)}`,
          };
      return { section, link: { documentId: document.id, sentenceIndex: passage.sentenceIndex } };
    }),
  };
}

export function buildNotesAskDocument(documents: VoticDocument[], scope: NotesAskScope) {
  const notes = buildNotesAskSections(documents, scope);
  return notes && { title: notes.title, sections: notes.sections.map((item) => item.section) };
}

export function notesAskScopeLabel(documents: VoticDocument[], scope: NotesAskScope) {
  const notes = notesForAskVotic(documents, scope);
  if (!notes.length) return "";
  if (scope.passageId) return `Asking about: 1 note · ${notes[0].document.title}`;
  if (scope.passageIds?.length)
    return `Asking about: ${notes.length} selected ${notes.length === 1 ? "note" : "notes"}`;
  if (scope.documentId)
    return `Asking about: ${notes[0].document.title} · ${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
  return `Asking about: All notes · ${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
}
