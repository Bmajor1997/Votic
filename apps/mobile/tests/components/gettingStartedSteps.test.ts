import { describe, expect, it } from "@jest/globals";
import { getting_started_steps } from "../../src/onboarding/GettingStartedCard";
import { SavedPassage, VoticDocument } from "../../src/documents/types";

function passage(extra: Partial<SavedPassage> = {}): SavedPassage {
  return { id: "p", sentenceIndex: 0, text: "Text.", note: "", createdAt: 1, updatedAt: 1, ...extra };
}
function doc(extra: Partial<VoticDocument> = {}): VoticDocument {
  return {
    id: "d",
    title: "Doc",
    sourceName: "Doc.pdf",
    plainText: "Text.",
    importedAt: 1,
    updatedAt: 1,
    progress: 0,
    sentenceIndex: 0,
    wordIndex: 0,
    playbackRate: 1,
    ...extra,
  };
}
const done = (documents: VoticDocument[], asked = false) =>
  Object.fromEntries(getting_started_steps(documents, asked).map((step) => [step.label, step.done]));

describe("getting_started_steps", () => {
  it("doesn't count Quick Notes as a document or as a saved passage", () => {
    const quick = doc({ id: "q", notebookKind: "quick-notes", savedPassages: [passage({ note: "Idea" })] });
    expect(done([quick])).toMatchObject({ "Add a document": false, "Save a passage": false });
  });

  it("doesn't count an Ask Votic answer saved to Notes as saving a passage", () => {
    const answer = passage({ note: "Votic's answer", tags: ["votic"] });
    expect(done([doc({ savedPassages: [answer] })])["Save a passage"]).toBe(false);
    expect(done([doc({ savedPassages: [passage()] })])["Save a passage"]).toBe(true);
  });
});
