import { describe, expect, it } from "vitest";
import { splitPassages } from "./passages";

describe("splitPassages", () => {
  it("never shows or speaks Markdown heading, bold, or quote marks", () => {
    const text =
      "# Getting started with Votic\n\nWelcome to **Votic**.\n\n## Read and listen\n\n> Press play to hear it.";
    const passages = splitPassages(text);
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
    expect(splitPassages(text)).toHaveLength(splitPassages(text.replace(/#+ /g, "")).length);
  });

  it("ends passages only at real sentence endings", () => {
    expect(
      splitPassages("Read it on Vice.com today. It costs 2.5 dollars! Scanned 12.10.26 12:53:13"),
    ).toEqual(["Read it on Vice.com today.", "It costs 2.5 dollars!", "Scanned 12.10.26 12:53:13"]);
    expect(splitPassages("Ask Dr. Lee, e.g. about J. K. Rowling. Then stop.")).toEqual([
      "Ask Dr. Lee, e.g. about J. K. Rowling.",
      "Then stop.",
    ]);
    expect(splitPassages('He said "Go." Then left.')).toEqual(['He said "Go."', "Then left."]);
  });

  it("keeps a heading as its own passage", () => {
    expect(splitPassages("Read and listen\n\nPress play to hear this guide.")).toEqual([
      "Read and listen",
      "Press play to hear this guide.",
    ]);
  });

  it("leaves hashtags and numbers alone", () => {
    expect(splitPassages("Use #1 and #votic tags.")).toEqual(["Use #1 and #votic tags."]);
  });
});
