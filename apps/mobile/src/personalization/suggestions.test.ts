import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, PersonalizationAnswers } from "../onboarding/onboardingModel";
import {
  askSuggestions,
  DEFAULT_ASK_SUGGESTIONS,
  explanationStyleArgs,
  hasSuggestionPreferences,
  notebookActions,
} from "./suggestions";

const answers = (change: Partial<PersonalizationAnswers>): PersonalizationAnswers => ({
  ...EMPTY_ANSWERS,
  ...change,
});

describe("Ask Votic suggestions from personalization", () => {
  it("lead with what the person asked for, then fill with the usual suggestions", () => {
    expect(askSuggestions(answers({ goals: ["find-quickly", "understand-reading"] }), null)).toEqual([
      "Help me understand this passage",
      "Find information",
      "Summarize this document",
      "Explain this section",
      "Find key points",
      "Help with my notes",
    ]);
  });
  it("only map answers with a direct match, and use the usual suggestions for the rest", () => {
    const indirect = answers({
      goals: ["remember", "listen-instead", "stay-focused"],
      readingHelp: ["ask-while-reading", "track-important", "resume"],
      keepingTrack: ["organize-key-points", "questions-with-notes", "find-notes", "quick-save"],
    });
    expect(askSuggestions(indirect, null)).toEqual(DEFAULT_ASK_SUGGESTIONS);
    expect(notebookActions(indirect, null)).toMatchObject({
      studyAction: { label: "Key points" },
      explainLabel: "Explain",
    });
  });
  it("offer simpler explanations to people who asked for them", () => {
    const simple = askSuggestions(
      answers({ goals: ["explain-difficult"], explanationStyle: "simple" }),
      null,
    );
    expect(simple[0]).toBe("Explain this section simply");
    expect(simple).not.toContain("Explain this section");
    expect(askSuggestions(answers({ readingHelp: ["simpler-language"] }), null)[0]).toBe(
      "Explain this section simply",
    );
  });
  it("connect note-taking answers to the notes suggestion", () => {
    expect(askSuggestions(answers({ keepingTrack: ["create-notes"] }), null)[0]).toBe("Help with my notes");
  });
  it("always show six, never more, without repeats", () => {
    const everything = answers({
      goals: [
        "understand-reading",
        "explain-difficult",
        "find-quickly",
        "summarize",
        "take-notes",
        "remember",
      ],
      readingHelp: ["key-points", "find-specific"],
      keepingTrack: ["find-notes"],
    });
    const shown = askSuggestions(everything, "work");
    expect(shown).toHaveLength(6);
    expect(new Set(shown).size).toBe(6);
    expect(shown).not.toContain("Find action items");
  });
  it("are the same for the same answers", () => {
    const a = answers({ goals: ["summarize", "take-notes"], readingHelp: ["key-points"] });
    expect(askSuggestions(a, null)).toEqual(askSuggestions({ ...a }, null));
  });
});

describe("legacy purpose compatibility", () => {
  it("keeps the old purpose suggestions until personalization is answered", () => {
    expect(askSuggestions(null, "work")).toContain("Find action items");
    expect(askSuggestions(answers({}), "research")).toContain("What should I investigate next?");
    expect(askSuggestions(answers({ readingHelp: ["decide-as-i-go"] }), "learning")).toContain(
      "Quiz me on this document",
    );
  });
  it("uses the defaults with neither answers nor a purpose", () => {
    expect(askSuggestions(null, null)).toEqual(DEFAULT_ASK_SUGGESTIONS);
    expect(askSuggestions(answers({}), "personal")).toEqual(DEFAULT_ASK_SUGGESTIONS);
  });
  it("lets personalization answers take over from the purpose", () => {
    expect(askSuggestions(answers({ goals: ["summarize"] }), "work")).not.toContain("Find action items");
    expect(hasSuggestionPreferences(answers({ keepingTrack: ["organize-myself"] }))).toBe(false);
  });
});

describe("Notes notebook actions", () => {
  it("use Key points as the study action for personalized people", () => {
    expect(notebookActions(answers({ goals: ["remember"] }), null).studyAction.label).toBe("Key points");
    expect(notebookActions(answers({ goals: ["summarize"] }), "learning").studyAction.label).toBe(
      "Key points",
    );
  });
  it("say 'Explain key ideas' to people who want things explained", () => {
    expect(notebookActions(answers({ goals: ["explain-difficult"] }), null).explainLabel).toBe(
      "Explain key ideas",
    );
    expect(
      notebookActions(answers({ explanationStyle: "simple", goals: ["take-notes"] }), null).explainLabel,
    ).toBe("Explain key ideas");
    expect(notebookActions(answers({ goals: ["take-notes"] }), null).explainLabel).toBe("Explain");
  });
  it("keep the legacy purpose actions as a fallback", () => {
    expect(notebookActions(null, "learning")).toMatchObject({
      studyAction: { label: "Quiz me" },
      explainLabel: "Explain key ideas",
    });
    expect(notebookActions(null, "work").studyAction.label).toBe("Action items");
    expect(notebookActions(null, "research").studyAction.label).toBe("Key findings");
    expect(notebookActions(null, null)).toMatchObject({
      studyAction: { label: "Key points" },
      explainLabel: "Explain",
    });
  });
});

describe("explanation style", () => {
  it("is sent for Quickly, Simply, and In detail, and left out for Adapt to me", () => {
    expect(explanationStyleArgs(answers({ explanationStyle: "quick" }))).toEqual(["quick"]);
    expect(explanationStyleArgs(answers({ explanationStyle: "detailed" }))).toEqual(["detailed"]);
    expect(explanationStyleArgs(answers({ explanationStyle: "adaptive" }))).toEqual([]);
    expect(explanationStyleArgs(answers({}))).toEqual([]);
    expect(explanationStyleArgs(null)).toEqual([]);
  });
});
