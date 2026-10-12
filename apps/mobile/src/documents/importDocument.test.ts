import { describe, expect, it } from "vitest";
import {
  clean_local_document_text,
  MAX_DOCUMENT_BYTES,
  supported_document,
  validate_import,
  validate_loaded_bytes,
} from "./importDocument";

describe("document import reliability", () => {
  it("accepts every supported document extension regardless of case", () => {
    for (const name of [
      "notes.txt",
      "README.MD",
      "book.pdf",
      "paper.docx",
      "slides.pptx",
      "legacy.PPT",
      "book.epub",
    ])
      expect(supported_document(name)).toBe(true);
  });

  it("rejects unsupported document types", () => {
    expect(() => validate_import({ name: "payload.exe", uri: "file:///payload.exe" })).toThrow(
      /Choose a TXT/,
    );
  });

  it("does not trust missing picker size metadata", () => {
    expect(() => validate_import({ name: "book.pdf", uri: "file:///book.pdf" })).not.toThrow();
    expect(() => validate_loaded_bytes(MAX_DOCUMENT_BYTES + 1)).toThrow(/too large/i);
  });

  it("enforces the actual loaded-byte boundary", () => {
    expect(() => validate_loaded_bytes(MAX_DOCUMENT_BYTES)).not.toThrow();
    expect(() => validate_loaded_bytes(MAX_DOCUMENT_BYTES + 1)).toThrow(/too large/i);
  });

  it("rejects invalid size values instead of treating them as safe", () => {
    expect(() => validate_import({ name: "book.pdf", uri: "file:///book.pdf", size: -1 })).toThrow(
      /determine this document's size/i,
    );
    expect(() => validate_loaded_bytes(Number.NaN)).toThrow(/determine this document's size/i);
  });

  it("cleans local text without damaging readable content", () => {
    expect(clean_local_document_text("Title\r\n\u0000First line.   \n\n\nSecond line.")).toBe(
      "Title\nFirst line.\n\nSecond line.",
    );
  });
});
