import { describe, expect, it } from "@jest/globals";
import { document_type_color } from "../../src/components/DocumentTypeIcon";

describe("document type colors", () => {
  it.each([
    ["paper.PDF", "#E77B7B"],
    ["notes.docx", "#5289E2"],
    ["legacy.doc", "#5289E2"],
    ["slides.pptx", "#CCAD32"],
    ["legacy.ppt", "#EA923D"],
    ["book.epub", "#AC82DE"],
    ["readme.md", "#657F91"],
  ])("colors %s as %s", (name, color) => {
    expect(document_type_color(name)).toBe(color);
  });
});
