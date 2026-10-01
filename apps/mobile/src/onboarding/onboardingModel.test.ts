import { describe, expect, it } from "vitest";
import {
  highlightModeFor,
  isAnswered,
  newOnboardingState,
  ONBOARDING_VERSION,
  parseOnboardingState,
  QUESTIONS,
  toggleMultiple,
} from "./onboardingModel";

describe("personalization questions", () => {
  it("asks the five questions in order with the agreed wording", () => {
    expect(QUESTIONS.map((question) => [question.title, question.kind])).toEqual([
      ["What would you like Votic to help you do?", "multiple"],
      ["How can Votic make reading easier for you?", "multiple"],
      ["When Votic explains something, how would you like it explained?", "single"],
      ["What would make listening more useful for you?", "multiple"],
      ["How should Votic help you keep track of important things?", "multiple"],
    ]);
    expect(QUESTIONS[2].options.map((option) => `${option.label}: ${option.detail}`)).toEqual([
      "Quickly: Just give me the answer.",
      "Simply: Make it easy to understand.",
      "In detail: Give me more context.",
      "Adapt to me: Let Votic decide based on what I ask.",
    ]);
  });
});

describe("multiple choice", () => {
  const question = QUESTIONS[1];
  it("adds and removes options", () => {
    let selected = toggleMultiple(question, [], "key-points");
    selected = toggleMultiple(question, selected, "read-aloud");
    expect(selected).toEqual(["key-points", "read-aloud"]);
    expect(toggleMultiple(question, selected, "key-points")).toEqual(["read-aloud"]);
  });
  it("keeps 'I'll decide as I go' on its own", () => {
    const decided = toggleMultiple(question, ["key-points", "read-aloud"], "decide-as-i-go");
    expect(decided).toEqual(["decide-as-i-go"]);
    expect(toggleMultiple(question, decided, "key-points")).toEqual(["key-points"]);
  });
  it("tracks whether a question has been answered", () => {
    const answers = newOnboardingState().answers;
    expect(isAnswered(QUESTIONS[0], answers)).toBe(false);
    expect(isAnswered(QUESTIONS[2], { ...answers, explanationStyle: "simple" })).toBe(true);
  });
});

describe("saved onboarding", () => {
  it("starts at version 1 on the first question", () => {
    expect(newOnboardingState()).toMatchObject({
      version: ONBOARDING_VERSION,
      currentStep: 0,
      completedAt: null,
    });
  });
  it("survives damaged or unexpected data", () => {
    expect(parseOnboardingState("not json")).toBeNull();
    expect(
      parseOnboardingState(
        JSON.stringify({
          currentStep: 99,
          answers: { goals: ["summarize", "hacked", "summarize"], explanationStyle: "loud" },
        }),
      ),
    ).toMatchObject({
      currentStep: 4,
      answers: { goals: ["summarize"], explanationStyle: null, listening: [] },
    });
  });
});

describe("listening answers", () => {
  it("map to the Reader's existing highlight setting", () => {
    expect(highlightModeFor(["highlight-words", "highlight-sentence"])).toBe("both");
    expect(highlightModeFor(["highlight-words"])).toBe("word");
    expect(highlightModeFor(["highlight-sentence", "change-speed"])).toBe("sentence");
  });
  it("leave the setting alone otherwise, and never turn listening off", () => {
    expect(highlightModeFor(["mainly-read"])).toBeNull();
    expect(highlightModeFor([])).toBeNull();
  });
});
