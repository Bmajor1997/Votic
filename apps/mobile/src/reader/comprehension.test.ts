import { describe, expect, it } from "vitest";
import { build_comprehension_questions } from "./comprehension";

describe("Check My Understanding", () => {
  const text =
    "The first section explains how photosynthesis converts light into stored chemical energy.\n\nChlorophyll absorbs light and helps power the reactions inside plant cells.\n\nLater sections describe how glucose is used and stored by the plant.";
  it("only builds questions from material at or before progress", () => {
    const questions = build_comprehension_questions(text, 0.4);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((q) => !q.answerHint.includes("Later sections"))).toBe(true);
  });
});
