import { describe, expect, it } from "@jest/globals";
import { document_type_color } from "../../src/components/DocumentTypeIcon";

describe("document type colors", () => {
  it.each([
    ["paper.PDF", "#E77B7B"],
    ["notes.docx", "#80A9EF"],
    ["legacy.doc", "#80A9EF"],
    ["slides.pptx", "#D9A078"],
    ["legacy.ppt", "#D9A078"],
    ["book.epub", "#A693D8"],
    ["readme.md", "#A6ADB8"],
  ])("colors %s as %s", (name, color) => {
    expect(document_type_color(name)).toBe(color);
  });
});
