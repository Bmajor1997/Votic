import { describe, expect, it } from "vitest";
import {
  answerLink,
  answerNoteForSource,
  askVoticContextKey,
  prepareAskRequest,
  recentHistory,
  initialQuestionFromParams,
  notesScopeFromParams,
  resolveAskVoticContext,
} from "./askVoticContext";
import { noteSelectionId } from "../notes/askVoticNotesContext";
import { VoticDocument } from "../documents/types";

function doc(id: string, title: string, extra: Partial<VoticDocument> = {}): VoticDocument {
  return {
    id,
    title,
    sourceName: title + ".pdf",
    plainText: `${title} text.`,
    importedAt: 1,
    updatedAt: 1,
    progress: 0,
    sentenceIndex: 0,
    wordIndex: 0,
    playbackRate: 1,
    savedPassages: [],
    ...extra,
  };
}
const biology = doc("doc-a", "Biology", {
  sentenceIndex: 12,
  savedPassages: [
    {
      id: "passage-3",
      sentenceIndex: 3,
      text: "Cells divide.",
      note: "Mitosis has four phases.",
      createdAt: 1,
      updatedAt: 1,
    },
    { id: "passage-7", sentenceIndex: 7, text: "DNA replicates.", note: "", createdAt: 1, updatedAt: 1 },
  ],
});
const history = doc("doc-b", "History", {
  sentenceIndex: 20,
  savedPassages: [
    {
      id: "passage-3",
      sentenceIndex: 3,
      text: "Rome fell.",
      note: "Why did it fall?",
      createdAt: 1,
      updatedAt: 1,
    },
  ],
});
const documents = [biology, history];

describe("Ask Votic context resolution", () => {
  it("uses the active document when opened without a notes scope", () => {
    const context = resolveAskVoticContext(documents, biology, {});
    expect(context.kind).toBe("document");
    expect(context.label).toBe("About Biology");
    if (context.kind !== "document") return;
    expect(prepareAskRequest(context, "q", []).document?.title).toBe("Biology");
    expect(context.saveSource).toEqual({
      documentId: "doc-a",
      sentenceIndex: 12,
      text: "Ask Votic answer about Biology",
    });
  });
  it("falls back to general help when nothing is open", () => {
    expect(resolveAskVoticContext(documents, null, {}).kind).toBe("general");
  });
  it("uses the notes scope instead of the active document", () => {
    const context = resolveAskVoticContext(documents, history, { notesDocumentId: "doc-a" });
    expect(context.kind).toBe("notes");
    if (context.kind !== "notes") return;
    expect(prepareAskRequest(context, "q", []).document?.title).toBe("Notes from Biology");
    expect(JSON.stringify(prepareAskRequest(context, "q", []).document)).not.toContain("Rome");
  });
  it("never falls back to the active document when the requested notes are gone", () => {
    const context = resolveAskVoticContext(documents, history, { notesDocumentId: "deleted-doc" });
    expect(context).toEqual({ kind: "notes-missing", label: "Notes unavailable" });
  });
  it("includes saved passages selected without a note", () => {
    const context = resolveAskVoticContext(documents, history, {
      notesPassageIds: noteSelectionId("doc-a", "passage-7"),
    });
    expect(context.kind).toBe("notes");
    if (context.kind !== "notes") return;
    expect(prepareAskRequest(context, "q", []).document?.sections[0].text).toBe(
      "Saved passage: DNA replicates.\nLocation: passage 8 of Biology",
    );
    expect(context.saveSource).toEqual({ documentId: "doc-a", sentenceIndex: 7, text: "DNA replicates." });
  });
  it("accepts array-valued route params", () => {
    expect(notesScopeFromParams({ notesDocumentId: ["doc-a"] })).toEqual({
      documentId: "doc-a",
      passageId: undefined,
      passageIds: undefined,
    });
    expect(initialQuestionFromParams({ initialQuestion: ["Quiz me"] })).toBe("Quiz me");
  });
});

describe("saving Ask Votic answers to Notes", () => {
  it("attaches an answer about one note to that note's document and location", () => {
    const context = resolveAskVoticContext(documents, history, {
      notesDocumentId: "doc-a",
      notesPassageId: "passage-3",
    });
    if (context.kind !== "notes" || !context.saveSource) throw new Error("expected a notes save source");
    const note = answerNoteForSource(
      documents,
      context.saveSource,
      "Prophase, metaphase, anaphase, telophase.",
      100,
      "votic-note-1",
    );
    expect(note?.documentId).toBe("doc-a");
    expect(note?.passage).toMatchObject({
      id: "votic-note-1",
      sentenceIndex: 3,
      text: "Cells divide.",
      note: "Prophase, metaphase, anaphase, telophase.",
      tags: ["votic"],
    });
  });
  it("attaches a notebook answer to the notebook's document, not the active document", () => {
    const context = resolveAskVoticContext(documents, history, { notesDocumentId: "doc-a" });
    if (context.kind !== "notes") throw new Error("expected notes context");
    expect(context.saveSource).toEqual({
      documentId: "doc-a",
      sentenceIndex: 3,
      text: "Ask Votic answer about Biology",
    });
  });
  it("attaches a single-document selection to that document even without a documentId param", () => {
    const context = resolveAskVoticContext(documents, history, {
      notesPassageIds: [noteSelectionId("doc-a", "passage-3"), noteSelectionId("doc-a", "passage-7")].join(
        ",",
      ),
    });
    if (context.kind !== "notes") throw new Error("expected notes context");
    expect(context.saveSource?.documentId).toBe("doc-a");
  });
  it("does not attach answers about notes from several documents to any single document", () => {
    const context = resolveAskVoticContext(documents, biology, {
      notesPassageIds: [noteSelectionId("doc-a", "passage-3"), noteSelectionId("doc-b", "passage-3")].join(
        ",",
      ),
    });
    if (context.kind !== "notes") throw new Error("expected notes context");
    expect(context.saveSource).toBeNull();
  });
  it("keeps an answer with the document it was asked about after the active document changes", () => {
    // The source is captured when the question is sent, while Biology is open.
    const askedAbout = resolveAskVoticContext(documents, biology, {});
    if (askedAbout.kind !== "document") throw new Error("expected document context");
    // Later the user opens History; saving the earlier answer must still target Biology.
    const nowActive = resolveAskVoticContext(documents, history, {});
    expect(nowActive.kind === "document" && nowActive.saveSource.documentId).toBe("doc-b");
    const note = answerNoteForSource(documents, askedAbout.saveSource, "Biology answer", 100, "votic-note-2");
    expect(note?.documentId).toBe("doc-a");
    expect(note?.passage.sentenceIndex).toBe(12);
  });
  it("refuses to save when the source document was deleted", () => {
    expect(
      answerNoteForSource([history], { documentId: "doc-a", sentenceIndex: 0, text: "x" }, "answer", 1, "id"),
    ).toBeNull();
  });
});

describe("resetting Ask Votic between contexts", () => {
  it("changes context key when switching between two documents", () => {
    expect(askVoticContextKey("doc-a", {})).not.toBe(askVoticContextKey("doc-b", {}));
    expect(askVoticContextKey("doc-a", {})).toBe(askVoticContextKey("doc-a", {}));
  });
  it("changes context key when switching between two notebooks", () => {
    expect(askVoticContextKey("doc-a", { notesDocumentId: "doc-a" })).not.toBe(
      askVoticContextKey("doc-a", { notesDocumentId: "doc-b" }),
    );
  });
  it("ignores the active document while a notes scope is in use", () => {
    expect(askVoticContextKey("doc-a", { notesDocumentId: "doc-a" })).toBe(
      askVoticContextKey("doc-b", { notesDocumentId: "doc-a" }),
    );
  });
  it("changes context key when leaving a notes scope for the active document", () => {
    expect(askVoticContextKey("doc-a", { notesDocumentId: "doc-a" })).not.toBe(
      askVoticContextKey("doc-a", {}),
    );
  });
  it("does not carry a prefilled question into the next context", () => {
    const fromNotes = { notesDocumentId: "doc-a", initialQuestion: "Quiz me on these notes" };
    expect(initialQuestionFromParams(fromNotes)).toBe("Quiz me on these notes");
    expect(askVoticContextKey("doc-a", fromNotes)).not.toBe(
      askVoticContextKey("doc-a", { notesDocumentId: "doc-a" }),
    );
    expect(initialQuestionFromParams({})).toBe("");
  });
});

describe("Ask Votic requests for long documents", () => {
  // 400 numbered sentences of ~60 characters: ~24,000 characters, about 8 sections.
  const sentencesText = Array.from(
    { length: 400 },
    (_, index) =>
      `Sentence ${index + 1} talks about ${index === 321 ? "photosynthesis in leaves" : "ordinary cell topics"}.`,
  ).join(" ");
  const longText = sentencesText.repeat(3);
  const book = doc("doc-book", "Book", { plainText: longText, sentenceIndex: 900 });

  it("sends every section of a short document with a Reader link for each", () => {
    const context = resolveAskVoticContext(
      [book],
      { ...book, plainText: sentencesText, sentenceIndex: 0 },
      {},
    );
    const request = prepareAskRequest(context, "What is this about?", []);
    expect(request.document?.title).toBe("Book");
    expect(request.document?.sections.length).toBe(request.links.length);
    expect(request.links[0]).toEqual({ documentId: "doc-book", sentenceIndex: 0 });
    expect(request.document?.sections.map((section) => section.text).join(" ")).toBe(sentencesText);
  });
  it("sends relevant excerpts of a long document within the budget, including the reading position", () => {
    const bigBook = { ...book, plainText: longText.repeat(4) };
    const context = resolveAskVoticContext([bigBook], bigBook, {});
    const request = prepareAskRequest(context, "Where does it mention photosynthesis?", []);
    const sections = request.document?.sections || [];
    expect(request.document?.title).toBe("Book (excerpts)");
    expect(
      sections.reduce((sum, section) => sum + section.heading.length + section.text.length, 0),
    ).toBeLessThanOrEqual(48_000);
    expect(sections.some((section) => section.text.includes("photosynthesis"))).toBe(true);
    expect(
      request.links.some((link) => link && link.sentenceIndex <= 900 && 900 - link.sentenceIndex < 60),
    ).toBe(true);
  });
  it("maps the section an answer points to back to a Reader location", () => {
    const context = resolveAskVoticContext([book], book, {});
    const request = prepareAskRequest(context, "q", []);
    expect(answerLink(request, 2)).toEqual(request.links[2]);
    expect(answerLink(request, null)).toBeNull();
    expect(answerLink(request, 999)).toBeNull();
  });
  it("links answers about notes to the note's own document and passage", () => {
    const context = resolveAskVoticContext(documents, history, {
      notesPassageIds: [noteSelectionId("doc-a", "passage-7"), noteSelectionId("doc-b", "passage-3")].join(
        ",",
      ),
    });
    const request = prepareAskRequest(context, "q", []);
    expect(request.links).toEqual([
      { documentId: "doc-a", sentenceIndex: 7 },
      { documentId: "doc-b", sentenceIndex: 3 },
    ]);
  });
  it("sends no document for general help", () => {
    expect(prepareAskRequest(resolveAskVoticContext(documents, null, {}), "How do I upload?", [])).toEqual({
      links: [],
      history: [],
    });
  });
});

describe("Ask Votic conversation history", () => {
  it("sends the last few messages, without the question being asked", () => {
    const messages = Array.from({ length: 9 }, (_, index) => ({
      role: (index % 2 ? "votic" : "user") as "user" | "votic",
      text: `Message ${index}`,
    }));
    const request = prepareAskRequest(resolveAskVoticContext(documents, biology, {}), "Follow-up?", messages);
    expect(request.history).toHaveLength(6);
    expect(request.history[0]).toEqual({ role: "assistant", text: "Message 3" });
    expect(request.history.at(-1)).toEqual({ role: "user", text: "Message 8" });
  });
  it("drops the retried question from history", () => {
    expect(
      recentHistory(
        [
          { role: "user", text: "First?" },
          { role: "votic", text: "Answer." },
          { role: "user", text: "Again?" },
        ],
        "Again?",
      ),
    ).toEqual([
      { role: "user", text: "First?" },
      { role: "assistant", text: "Answer." },
    ]);
  });
  it("trims long earlier answers", () => {
    const [item] = recentHistory([{ role: "votic", text: "a".repeat(5000) }], "Next?");
    expect(item.text.length).toBe(1501);
  });
});
