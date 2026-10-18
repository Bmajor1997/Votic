import { describe, expect, it } from "vitest";
import { IMPORT_TYPES, supported_document } from "./importDocument";
import { FILE_TYPE_PALETTE, file_type_colors, resolve_file_type } from "./fileTypes";

describe("file identities", () => {
  it.each([
    "pdf",
    "doc",
    "docx",
    "txt",
    "md",
    "rtf",
    "odt",
    "html",
    "htm",
    "epub",
    "jpg",
    "jpeg",
    "png",
    "heic",
    "heif",
    "webp",
    "ppt",
    "pptx",
  ])("recognizes %s consistently", (extension) => {
    const expected = resolve_file_type({ extension });
    expect(resolve_file_type({ filename: `C:\\files\\My.long report.${extension.toUpperCase()} ` })).toEqual(
      expected,
    );
    expect(resolve_file_type({ extension: `.${extension.toUpperCase()}` })).toEqual(expected);
    expect(expected.monogram).toBe(extension.toUpperCase());
    expect(expected.family).not.toBe("unknown");
  });
  it.each(Object.entries(IMPORT_TYPES))("covers actual importer MIME %s", (mimeType, extension) => {
    expect(supported_document(`file.${extension}`)).toBe(true);
    expect(resolve_file_type({ filename: "unnamed", mimeType }).extension).toBe(extension);
  });
  it("uses the final suffix and prefers a known filename over MIME", () => {
    expect(resolve_file_type({ filename: "report.pdf.exe" }).monogram).toBe("FILE");
    expect(resolve_file_type({ filename: "report.PDF", mimeType: "text/plain" }).monogram).toBe("PDF");
    expect(resolve_file_type({ filename: "https://host/report.PDF?download=1#page=2" }).monogram).toBe("PDF");
    expect(resolve_file_type({ extension: "png", filename: "report.pdf" }).monogram).toBe("PNG");
  });
  it("falls back to normalized MIME for missing or unrecognized extensions", () => {
    expect(
      resolve_file_type({ filename: "attachment.bin", mimeType: " Application/PDF; charset=UTF-8 " })
        .monogram,
    ).toBe("PDF");
    expect(resolve_file_type({ mimeType: "image/heic" }).monogram).toBe("HEIC");
  });
  it.each([
    ["Budget#2026.pdf", "PDF"],
    ["What?Now.docx", "DOCX"],
    ["/documents/Budget#2026.pdf", "PDF"],
    ["C:\\files\\Budget#2026.pdf", "PDF"],
    ["report.pdf#draft.exe", "FILE"],
    ["https://host/report.pdf?download=1#page=2", "PDF"],
    ["file:///documents/report.docx#page=2", "DOCX"],
    ["content://provider/report.pdf?download=1", "PDF"],
  ])("distinguishes local filename characters from URL delimiters: %s", (filename, monogram) => {
    expect(resolve_file_type({ filename }).monogram).toBe(monogram);
  });
  it.each([
    undefined,
    "",
    "README",
    ".pdf",
    "file.",
    "document.unknown",
    "document.constructor",
    "document.__proto__",
  ])("handles unknown input %s", (filename) => {
    expect(resolve_file_type({ filename }).family).toBe("unknown");
    expect(resolve_file_type({ filename }).monogram).toBe("FILE");
  });
  it("handles entirely missing metadata and prototype-like MIME keys", () => {
    expect(resolve_file_type().label).toBe("File");
    expect(resolve_file_type({ mimeType: "constructor" }).family).toBe("unknown");
  });
  it.each([
    ["pdf", "pdf"],
    ["docx", "word"],
    ["txt", "text"],
    ["md", "text"],
    ["rtf", "rtf"],
    ["odt", "odt"],
    ["htm", "html"],
    ["epub", "epub"],
    ["jpeg", "image"],
    ["png", "image"],
    ["heic", "photo"],
    ["webp", "photo"],
    ["pptx", "slides"],
  ] as const)("maps %s to its palette", (extension, family) => {
    const type = resolve_file_type({ extension });
    expect(type.family).toBe(family);
    expect(file_type_colors(type, false).foreground).toBe(FILE_TYPE_PALETTE[family].ink);
    expect(file_type_colors(type, true).accent).toBe(FILE_TYPE_PALETTE[family].accent);
    expect(file_type_colors(type, true).foreground).not.toBe(FILE_TYPE_PALETTE[family].ink);
  });
  it("does not change upload support through display-only formats", () => {
    expect(supported_document("photo.heic")).toBe(false);
    expect(supported_document("legacy.doc")).toBe(false);
  });
});
