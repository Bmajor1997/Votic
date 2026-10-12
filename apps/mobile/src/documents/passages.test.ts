import { describe, expect, it } from "vitest";
import { split_passages } from "./passages";

describe("split_passages", () => {
  it("never shows or speaks Markdown heading, bold, or quote marks", () => {
    const text =
      "# Getting started with Votic\n\nWelcome to **Votic**.\n\n## Read and listen\n\n> Press play to hear it.";
    const passages = split_passages(text);
    expect(passages).toEqual([
      "Getting started with Votic",
      "Welcome to Votic.",
      "Read and listen",
      "Press play to hear it.",
    ]);
    expect(passages.join(" ")).not.toMatch(/[#*>]/);
  });

  it("keeps the same passage numbers as before, so saved places don't move", () => {
    const text = "# Title\n\nOne. Two! Three?\n\n## Next\n\nFour.";
    expect(split_passages(text)).toHaveLength(split_passages(text.replace(/#+ /g, "")).length);
  });

  it("ends passages only at real sentence endings", () => {
    expect(
      split_passages("Read it on Vice.com today. It costs 2.5 dollars! Scanned 12.10.26 12:53:13"),
    ).toEqual(["Read it on Vice.com today.", "It costs 2.5 dollars!", "Scanned 12.10.26 12:53:13"]);
    expect(split_passages("Ask Dr. Lee, e.g. about J. K. Rowling. Then stop.")).toEqual([
      "Ask Dr. Lee, e.g. about J. K. Rowling.",
      "Then stop.",
    ]);
    expect(split_passages('He said "Go." Then left.')).toEqual(['He said "Go."', "Then left."]);
  });

  it("keeps a heading as its own passage", () => {
    expect(split_passages("Read and listen\n\nPress play to hear this guide.")).toEqual([
      "Read and listen",
      "Press play to hear this guide.",
    ]);
  });

  it("preserves paragraph boundaries in Windows line endings", () => {
    expect(split_passages("# Heading\r\n\r\nRead this sentence.")).toEqual([
      "Heading",
      "Read this sentence.",
    ]);
  });

  it("handles long passages containing many abbreviations", () => {
    const text = "Dr. Lee and ".repeat(10000) + "colleagues arrived. Next.";
    expect(split_passages(text)).toEqual([text.slice(0, -6).trim(), "Next."]);
  });

  it("leaves hashtags and numbers alone", () => {
    expect(split_passages("Use #1 and #votic tags.")).toEqual(["Use #1 and #votic tags."]);
  });
});
