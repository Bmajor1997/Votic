import { describe, expect, it } from "vitest";
import {
  highlight_mode_for,
  is_answered,
  new_onboarding_state,
  ONBOARDING_VERSION,
  parse_onboarding_state,
  QUESTIONS,
  toggle_multiple,
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
    let selected = toggle_multiple(question, [], "key-points");
    selected = toggle_multiple(question, selected, "read-aloud");
    expect(selected).toEqual(["key-points", "read-aloud"]);
    expect(toggle_multiple(question, selected, "key-points")).toEqual(["read-aloud"]);
  });
  it("keeps 'I'll decide as I go' on its own", () => {
    const decided = toggle_multiple(question, ["key-points", "read-aloud"], "decide-as-i-go");
    expect(decided).toEqual(["decide-as-i-go"]);
    expect(toggle_multiple(question, decided, "key-points")).toEqual(["key-points"]);
  });
  it("tracks whether a question has been answered", () => {
    const answers = new_onboarding_state().answers;
    expect(is_answered(QUESTIONS[0], answers)).toBe(false);
    expect(is_answered(QUESTIONS[2], { ...answers, explanationStyle: "simple" })).toBe(true);
  });
});

describe("saved onboarding", () => {
  it("starts at version 1 on the first question", () => {
    expect(new_onboarding_state()).toMatchObject({
      version: ONBOARDING_VERSION,
      currentStep: 0,
      completedAt: null,
    });
  });
  it("survives damaged or unexpected data", () => {
    expect(parse_onboarding_state("not json")).toBeNull();
    expect(
      parse_onboarding_state(
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
    expect(highlight_mode_for(["highlight-words", "highlight-sentence"])).toBe("both");
    expect(highlight_mode_for(["highlight-words"])).toBe("word");
    expect(highlight_mode_for(["highlight-sentence", "change-speed"])).toBe("sentence");
  });
  it("leave the setting alone otherwise, and never turn listening off", () => {
    expect(highlight_mode_for(["mainly-read"])).toBeNull();
    expect(highlight_mode_for([])).toBeNull();
  });
});
