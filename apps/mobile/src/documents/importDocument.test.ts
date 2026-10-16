import { describe, expect, it } from "vitest";
import {
  clean_local_document_text,
  IMPORT_TYPES,
  is_page_photo,
  MAX_DOCUMENT_BYTES,
  MAX_PAGE_PHOTO_BYTES,
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
      "letter.rtf",
      "essay.ODT",
      "page.html",
      "page.htm",
      "photo.JPG",
      "photo.jpeg",
      "page.png",
      "page.webp",
    ])
      expect(supported_document(name)).toBe(true);
  });

  it("rejects unsupported document types", () => {
    expect(() => validate_import({ name: "payload.exe", uri: "file:///payload.exe" })).toThrow(
      /Choose a TXT/,
    );
  });

  it("offers a readable extension for every type the picker and share sheet accept", () => {
    for (const extension of Object.values(IMPORT_TYPES))
      expect(supported_document(`file.${extension}`)).toBe(true);
  });

  it("refuses an oversized photo of a page before it is uploaded", () => {
    expect(is_page_photo("page.webp")).toBe(true);
    expect(is_page_photo("book.pdf")).toBe(false);
    expect(() => validate_loaded_bytes(MAX_PAGE_PHOTO_BYTES, "page.jpg")).not.toThrow();
    expect(() => validate_loaded_bytes(MAX_PAGE_PHOTO_BYTES + 1, "page.jpg")).toThrow(
      /photos of pages is 12 MB/,
    );
    expect(() => validate_loaded_bytes(MAX_PAGE_PHOTO_BYTES + 1, "book.pdf")).not.toThrow();
    expect(() =>
      validate_import({ name: "page.png", size: MAX_PAGE_PHOTO_BYTES + 1, uri: "file:///page.png" }),
    ).toThrow(/12 MB/);
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
