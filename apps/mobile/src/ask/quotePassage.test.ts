import { describe, expect, it } from "vitest";
import { quote_passage } from "./quotePassage";

const posting = [
  "Python/SaaS Developer to Build a Compliance Platform",
  "Job Description",
  "We're building a web-based SaaS assessment tool. It helps enterprises understand risk.",
  "Requirements",
  "Strong experience with Python backend development. Solid relational database skills.",
].join("\n\n");
// Passages: 0 title, 1 "Job Description", 2-3 its sentences, 4 "Requirements", 5-6 its sentences.

describe("quote_passage", () => {
  it("finds the passage that holds the quoted sentence", () => {
    expect(quote_passage(posting, "Solid relational database skills.")).toBe(6);
    expect(quote_passage(posting, "strong experience with   Python backend development")).toBe(5);
  });

  it("ignores curly quotes and starts looking from the answer's section", () => {
    expect(quote_passage(posting, "We’re building a web-based SaaS assessment tool.", 2)).toBe(2);
    expect(quote_passage(posting, "Solid relational database skills.", 6)).toBe(6);
    // It still finds a sentence that sits before the section it was told to start from.
    expect(quote_passage(posting, "It helps enterprises understand risk.", 5)).toBe(3);
  });

  it("matches the first passage of a quote that runs across passages", () => {
    expect(
      quote_passage(
        posting,
        "Strong experience with Python backend development. Solid relational database skills.",
      ),
    ).toBe(5);
  });

  it("returns null when there's nothing to find", () => {
    expect(quote_passage(posting, "Ten years of Rust.")).toBeNull();
    expect(quote_passage(posting, null)).toBeNull();
    expect(quote_passage(posting, "   ")).toBeNull();
  });
});
