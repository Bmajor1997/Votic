import { describe, expect, it } from "vitest";
import { splitPassages } from "./passages";

describe("splitPassages", () => {
  it("never shows or speaks Markdown heading, bold, or quote marks", () => {
    const text =
      "# Getting started with Votic\n\nWelcome to **Votic**.\n\n## Read and listen\n\n> Press play to hear it.";
    const passages = splitPassages(text);
    expect(passages).toEqual([
      "Getting started with Votic\n\nWelcome to Votic.",
      "Read and listen\n\nPress play to hear it.",
    ]);
    expect(passages.join(" ")).not.toMatch(/[#*>]/);
  });

  it("keeps the same passage numbers as before, so saved places don't move", () => {
    const text = "# Title\n\nOne. Two! Three?\n\n## Next\n\nFour.";
    expect(splitPassages(text)).toHaveLength(splitPassages(text.replace(/#+ /g, "")).length);
  });

  it("leaves hashtags and numbers alone", () => {
    expect(splitPassages("Use #1 and #votic tags.")).toEqual(["Use #1 and #votic tags."]);
  });
});
