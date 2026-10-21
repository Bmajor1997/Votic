import { describe, expect, it } from "vitest";
import { COMPREHENSION_QUESTIONS, MAX_SOURCE_CHARS, understanding_source } from "./comprehension";

describe("Check My Understanding", () => {
  const text =
    "The first section explains how photosynthesis converts light into stored chemical energy.\n\nChlorophyll absorbs light and helps power the reactions inside plant cells.\n\nLater sections describe how glucose is used and stored by the plant.";

  it("only uses material at or before the reader's position, so checking never spoils what comes next", () => {
    const source = understanding_source(text, 0.4);
    expect(source).toContain("photosynthesis converts light");
    expect(source).not.toContain("Later sections");
    expect(understanding_source(text, 1)).toContain("Later sections");
  });

  it("names each question by a stable kind, not by its place in a list", () => {
    expect(COMPREHENSION_QUESTIONS.map((question) => question.id)).toEqual([
      "main-point",
      "supporting-detail",
      "explain-it",
    ]);
    expect(COMPREHENSION_QUESTIONS.find((question) => question.id === "main-point")?.prompt).toMatch(
      /main point/,
    );
    expect(COMPREHENSION_QUESTIONS.find((question) => question.id === "supporting-detail")?.prompt).toMatch(
      /detail/,
    );
  });

  it("keeps the most recent reading within the server's limit", () => {
    const long = Array.from({ length: 800 }, (_, index) => `Sentence number ${index} has some words.`).join(
      " ",
    );
    const source = understanding_source(long, 1);
    expect(source.length).toBeLessThanOrEqual(MAX_SOURCE_CHARS);
    expect(source).toContain("Sentence number 799");
    expect(source).not.toContain("Sentence number 0 ");
  });

  it("offers nothing to check before there is enough text", () => {
    expect(understanding_source("Too short.", 1)).toBe("");
    expect(understanding_source("", 1)).toBe("");
  });
});
