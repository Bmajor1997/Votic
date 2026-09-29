import { SavedPassage, VoticDocument } from "../documents/types";
import {
  buildNotesAskSections,
  notesAskScopeLabel,
  notesForAskVotic,
  NotesAskScope,
} from "../notes/askVoticNotesContext";
import { AskLink, chunkDocument, LinkedSection, selectSections } from "./documentSections";

type Param = string | string[] | undefined;
export type AskVoticParams = {
  notesDocumentId?: Param;
  notesPassageId?: Param;
  notesPassageIds?: Param;
  initialQuestion?: Param;
};
export type AskDocument = { title: string; sections: { heading: string; text: string }[] };
/** Where a saved answer belongs, captured when the question is asked. */
export type AskAnswerSource = { documentId: string; sentenceIndex: number; text: string };
export type AskVoticContext =
  | {
      kind: "notes";
      title: string;
      sections: LinkedSection[];
      label: string;
      saveSource: AskAnswerSource | null;
    }
  | { kind: "notes-missing"; label: string }
  | {
      kind: "document";
      documentId: string;
      title: string;
      plainText: string;
      sentenceIndex: number;
      label: string;
      saveSource: AskAnswerSource;
    }
  | { kind: "general"; label: string };
export type AskHistoryItem = { role: "user" | "assistant"; text: string };
/** Everything sent for one question, plus the Reader location of each section sent. */
export type AskRequest = { document?: AskDocument; links: (AskLink | null)[]; history: AskHistoryItem[] };

export const MISSING_NOTES_MESSAGE =
  "These notes are no longer available. Go back to Notes and choose them again.";
export const HISTORY_MESSAGES = 6;
export const HISTORY_MESSAGE_CHARS = 1500;

function single(value: Param) {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === "string" && text.trim() ? text : undefined;
}

export function notesScopeFromParams(params: AskVoticParams): NotesAskScope | null {
  const documentId = single(params.notesDocumentId);
  const passageId = single(params.notesPassageId);
  const passageIds = single(params.notesPassageIds)
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!documentId && !passageId && !passageIds?.length) return null;
  return { documentId, passageId, passageIds: passageIds?.length ? passageIds : undefined };
}

export function initialQuestionFromParams(params: AskVoticParams) {
  return single(params.initialQuestion) || "";
}

/** Changes whenever Ask Votic is pointed at a different document, notes scope, or prefilled question. */
export function askVoticContextKey(activeDocumentId: string | null | undefined, params: AskVoticParams) {
  const scope = notesScopeFromParams(params);
  return JSON.stringify(
    scope
      ? { notes: scope, question: initialQuestionFromParams(params) }
      : { document: activeDocumentId || null, question: initialQuestionFromParams(params) },
  );
}

function notesSaveSource(documents: VoticDocument[], scope: NotesAskScope): AskAnswerSource | null {
  const notes = notesForAskVotic(documents, scope);
  const document = notes[0]?.document;
  // Answers about notes from several documents have no single home, so they are not attached to any document.
  if (!document || notes.some((item) => item.document.id !== document.id)) return null;
  const anchor = notes[0].passage;
  return {
    documentId: document.id,
    sentenceIndex: anchor.sentenceIndex,
    text: notes.length === 1 ? anchor.text : `Ask Votic answer about ${document.title}`,
  };
}

export function resolveAskVoticContext(
  documents: VoticDocument[],
  activeDocument: VoticDocument | null,
  params: AskVoticParams,
): AskVoticContext {
  const scope = notesScopeFromParams(params);
  if (scope) {
    const notes = buildNotesAskSections(documents, scope);
    if (!notes) return { kind: "notes-missing", label: "Notes unavailable" };
    return {
      kind: "notes",
      title: notes.title,
      sections: notes.sections,
      label: notesAskScopeLabel(documents, scope),
      saveSource: notesSaveSource(documents, scope),
    };
  }
  if (activeDocument)
    return {
      kind: "document",
      documentId: activeDocument.id,
      title: activeDocument.title,
      plainText: activeDocument.plainText,
      sentenceIndex: activeDocument.sentenceIndex,
      label: "About " + activeDocument.title,
      saveSource: {
        documentId: activeDocument.id,
        sentenceIndex: activeDocument.sentenceIndex,
        text: `Ask Votic answer about ${activeDocument.title}`,
      },
    };
  return { kind: "general", label: "Reading and document help" };
}

/** The last few exchanges, so follow-up questions make sense. Excludes the question being asked. */
export function recentHistory(
  messages: { role: "user" | "votic"; text: string }[],
  question: string,
): AskHistoryItem[] {
  const last = messages[messages.length - 1];
  const prior = last?.role === "user" && last.text === question ? messages.slice(0, -1) : messages;
  return prior.slice(-HISTORY_MESSAGES).map((message) => ({
    role: message.role === "user" ? "user" : "assistant",
    text:
      message.text.length > HISTORY_MESSAGE_CHARS
        ? message.text.slice(0, HISTORY_MESSAGE_CHARS) + "…"
        : message.text,
  }));
}

function toRequest(
  title: string,
  selected: { items: LinkedSection[]; partial: boolean },
  history: AskHistoryItem[],
): AskRequest {
  return {
    document: {
      title: selected.partial ? `${title} (excerpts)` : title,
      sections: selected.items.map((item) => item.section),
    },
    links: selected.items.map((item) => item.link),
    history,
  };
}

export function prepareAskRequest(
  context: AskVoticContext,
  question: string,
  messages: { role: "user" | "votic"; text: string }[],
): AskRequest {
  const history = recentHistory(messages, question);
  if (context.kind === "notes")
    return toRequest(context.title, selectSections(context.sections, question), history);
  if (context.kind === "document") {
    const sections = chunkDocument(context.documentId, context.plainText);
    const anchorIndex = sections.reduce(
      (found, item, index) => (item.link && item.link.sentenceIndex <= context.sentenceIndex ? index : found),
      0,
    );
    return toRequest(context.title, selectSections(sections, question, { anchorIndex }), history);
  }
  return { links: [], history };
}

/** Maps the section the answer points to back to a Reader location. */
export function answerLink(request: AskRequest, sectionIndex: number | null): AskLink | null {
  return sectionIndex === null ? null : (request.links[sectionIndex] ?? null);
}

export function answerNoteForSource(
  documents: VoticDocument[],
  source: AskAnswerSource,
  answer: string,
  now: number,
  id: string,
): { documentId: string; passage: SavedPassage } | null {
  const target = documents.find((document) => document.id === source.documentId);
  if (!target) return null;
  return {
    documentId: target.id,
    passage: {
      id,
      sentenceIndex: source.sentenceIndex,
      text: source.text,
      note: answer,
      createdAt: now,
      updatedAt: now,
      noteType: "note",
      tags: ["votic"],
    },
  };
}
