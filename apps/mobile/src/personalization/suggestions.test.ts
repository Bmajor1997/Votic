import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, PersonalizationAnswers } from "../onboarding/onboardingModel";
import {
  ask_suggestions,
  DEFAULT_ASK_SUGGESTIONS,
  explanation_style_args,
  has_suggestion_preferences,
  notebook_actions,
} from "./suggestions";

const answers = (change: Partial<PersonalizationAnswers>): PersonalizationAnswers => ({
  ...EMPTY_ANSWERS,
  ...change,
});

describe("Ask Votic suggestions from personalization", () => {
  it("lead with what the person asked for, then fill with the usual suggestions", () => {
    expect(ask_suggestions(answers({ goals: ["find-quickly", "understand-reading"] }), null)).toEqual([
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
    expect(ask_suggestions(indirect, null)).toEqual(DEFAULT_ASK_SUGGESTIONS);
    expect(notebook_actions(indirect, null)).toMatchObject({
      studyAction: { label: "Key points" },
      explainLabel: "Explain",
    });
  });
  it("offer simpler explanations to people who asked for them", () => {
    const simple = ask_suggestions(
      answers({ goals: ["explain-difficult"], explanationStyle: "simple" }),
      null,
    );
    expect(simple[0]).toBe("Explain this section simply");
    expect(simple).not.toContain("Explain this section");
    expect(ask_suggestions(answers({ readingHelp: ["simpler-language"] }), null)[0]).toBe(
      "Explain this section simply",
    );
  });
  it("connect note-taking answers to the notes suggestion", () => {
    expect(ask_suggestions(answers({ keepingTrack: ["create-notes"] }), null)[0]).toBe("Help with my notes");
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
    const shown = ask_suggestions(everything, "work");
    expect(shown).toHaveLength(6);
    expect(new Set(shown).size).toBe(6);
    expect(shown).not.toContain("Find action items");
  });
  it("are the same for the same answers", () => {
    const a = answers({ goals: ["summarize", "take-notes"], readingHelp: ["key-points"] });
    expect(ask_suggestions(a, null)).toEqual(ask_suggestions({ ...a }, null));
  });
});

describe("legacy purpose compatibility", () => {
  it("keeps the old purpose suggestions until personalization is answered", () => {
    expect(ask_suggestions(null, "work")).toContain("Find action items");
    expect(ask_suggestions(answers({}), "research")).toContain("What should I investigate next?");
    expect(ask_suggestions(answers({ readingHelp: ["decide-as-i-go"] }), "learning")).toContain(
      "Quiz me on this document",
    );
  });
  it("uses the defaults with neither answers nor a purpose", () => {
    expect(ask_suggestions(null, null)).toEqual(DEFAULT_ASK_SUGGESTIONS);
    expect(ask_suggestions(answers({}), "personal")).toEqual(DEFAULT_ASK_SUGGESTIONS);
  });
  it("lets personalization answers take over from the purpose", () => {
    expect(ask_suggestions(answers({ goals: ["summarize"] }), "work")).not.toContain("Find action items");
    expect(has_suggestion_preferences(answers({ keepingTrack: ["organize-myself"] }))).toBe(false);
  });
});

describe("Notes notebook actions", () => {
  it("use Key points as the study action for personalized people", () => {
    expect(notebook_actions(answers({ goals: ["remember"] }), null).studyAction.label).toBe("Key points");
    expect(notebook_actions(answers({ goals: ["summarize"] }), "learning").studyAction.label).toBe(
      "Key points",
    );
  });
  it("say 'Explain key ideas' to people who want things explained", () => {
    expect(notebook_actions(answers({ goals: ["explain-difficult"] }), null).explainLabel).toBe(
      "Explain key ideas",
    );
    expect(
      notebook_actions(answers({ explanationStyle: "simple", goals: ["take-notes"] }), null).explainLabel,
    ).toBe("Explain key ideas");
    expect(notebook_actions(answers({ goals: ["take-notes"] }), null).explainLabel).toBe("Explain");
  });
  it("keep the legacy purpose actions as a fallback", () => {
    expect(notebook_actions(null, "learning")).toMatchObject({
      studyAction: { label: "Quiz me" },
      explainLabel: "Explain key ideas",
    });
    expect(notebook_actions(null, "work").studyAction.label).toBe("Action items");
    expect(notebook_actions(null, "research").studyAction.label).toBe("Key findings");
    expect(notebook_actions(null, null)).toMatchObject({
      studyAction: { label: "Key points" },
      explainLabel: "Explain",
    });
  });
});

describe("explanation style", () => {
  it("is sent for Quickly, Simply, and In detail, and left out for Adapt to me", () => {
    expect(explanation_style_args(answers({ explanationStyle: "quick" }))).toEqual(["quick"]);
    expect(explanation_style_args(answers({ explanationStyle: "detailed" }))).toEqual(["detailed"]);
    expect(explanation_style_args(answers({ explanationStyle: "adaptive" }))).toEqual([]);
    expect(explanation_style_args(answers({}))).toEqual([]);
    expect(explanation_style_args(null)).toEqual([]);
  });
});

describe("notes_suggestions", () => {
  it("rewords document suggestions for notes and keeps the rest", async () => {
    const { notes_suggestions, DEFAULT_ASK_SUGGESTIONS } = await import("./suggestions");
    expect(notes_suggestions(DEFAULT_ASK_SUGGESTIONS)).toEqual([
      "Summarize these notes",
      "Explain these notes",
      "Find key points",
      "What do these notes have in common?",
      "Compare key ideas",
      "Find information",
    ]);
    expect(notes_suggestions(DEFAULT_ASK_SUGGESTIONS).join(" ")).not.toMatch(/document|section|passage/);
  });
});
