import { describe, expect, it } from "@jest/globals";
import { documentTypeColor } from "../../src/components/DocumentTypeIcon";

describe("document type colors", () => {
  it.each([
    ["paper.PDF", "#DC2626"],
    ["notes.docx", "#2563EB"],
    ["legacy.doc", "#2563EB"],
    ["slides.pptx", "#EA580C"],
    ["legacy.ppt", "#EA580C"],
    ["book.epub", "#7C3AED"],
    ["readme.md", "#059669"],
  ])("colors %s as %s", (name, color) => {
    expect(documentTypeColor(name)).toBe(color);
  });
});
