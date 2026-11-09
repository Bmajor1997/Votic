import { describe, expect, it } from "vitest";
import {
  document_type_filter,
  empty_filter_message,
  file_type_label,
  readable_title,
  sort_documents,
} from "./documentDisplay";
import { strip_file_extension } from "./fileTypes";

describe("document titles", () => {
  it.each([
    ["sample.pdf", "sample"],
    ["first 25 days CWAT Schedule.pdf", "first 25 days CWAT Schedule"],
    ["first_25_days_CWAT_Schedule.pdf", "first 25 days CWAT Schedule"],
    ["Quarterly Report.PDF", "Quarterly Report"],
    ["notes.docx  ", "notes"],
    ["  spaced   out   title.txt", "spaced out title"],
    ["Résumé – été 2026.pdf", "Résumé – été 2026"],
    ["日本語の資料.epub", "日本語の資料"],
    ["report.v2.final.pdf", "report v2 final"],
  ])("shows %j as %j, without the extension read as a word", (title, shown) => {
    expect(readable_title(title)).toBe(shown);
  });

  it("keeps endings that are not a document type Votic knows", () => {
    expect(readable_title("Release v1.2 notes")).toBe("Release v1.2 notes");
    expect(strip_file_extension("Archive.zip")).toBe("Archive.zip");
    expect(strip_file_extension("Meeting with Dr. Who")).toBe("Meeting with Dr. Who");
    expect(strip_file_extension("Chapter 3.5")).toBe("Chapter 3.5");
  });

  it("never empties a name that is only an extension", () => {
    expect(strip_file_extension(".pdf")).toBe(".pdf");
    expect(readable_title("   ")).toBe("Untitled document");
  });

  it("leaves the original filename's type intact for metadata", () => {
    // The stored filename keeps its extension, so the library can still show "sample.pdf" and its type.
    expect(file_type_label("sample.pdf")).toBe("PDF");
    expect(file_type_label("first 25 days CWAT Schedule.PDF")).toBe("PDF");
  });
});

describe("document_type_label", () => {
  it("names webpages and scans for what they are, and files by their format", async () => {
    const { document_type_label } = await import("./documentDisplay");
    expect(document_type_label({ sourceName: "Octopus - Wikipedia.txt", origin: "webpage" })).toBe("Webpage");
    expect(document_type_label({ sourceName: "MDN.txt", sourceUrl: "https://developer.mozilla.org/" })).toBe(
      "Webpage",
    );
    expect(document_type_label({ sourceName: "Scanned document.txt", origin: "scan" })).toBe("Scan");
    expect(document_type_label({ sourceName: "notes.txt", origin: "file" })).toBe("Text");
    expect(document_type_label({ sourceName: "report.pdf" })).toBe("PDF");
  });
});

describe("file type order", () => {
  it("groups by type and shows recently added files first within each group", () => {
    const names = ["z.txt", "b.PDF", "c.html", "a.pdf", "A.html", "B.txt"];
    const documents = names.map((sourceName, index) => ({
      id: String(index),
      sourceName,
      title: "Renamed title",
      importedAt: names.length - index,
    })) as import("./types").VoticDocument[];
    expect(sort_documents(documents, "type").map((d) => d.sourceName)).toEqual([
      "b.PDF",
      "a.pdf",
      "c.html",
      "A.html",
      "z.txt",
      "B.txt",
    ]);
    expect(documents.map((d) => d.sourceName)).toEqual(names);
    expect(sort_documents([], "type")).toEqual([]);
  });

  it("breaks equal timestamps by filename and leaves separate sorting choices intact", () => {
    const documents = [
      { id: "a", title: "A", sourceName: "A.pdf", importedAt: 4 },
      { id: "z", title: "Z", sourceName: "z.pdf", importedAt: 4 },
      { id: "old", title: "Old", sourceName: "old.pdf", importedAt: 1 },
    ] as import("./types").VoticDocument[];
    expect(sort_documents(documents, "type").map((d) => d.id)).toEqual(["a", "z", "old"]);
    expect(sort_documents(documents, "title").map((d) => d.id)).toEqual(["a", "old", "z"]);
  });
});

it("groups converted webpages and scans by their displayed identity instead of their text storage", () => {
  const documents = [
    { id: "w", title: "Web", sourceName: "A.txt", origin: "webpage" },
    { id: "t", title: "Text", sourceName: "Z.txt", origin: "file" },
    { id: "s", title: "Scan", sourceName: "B.txt", origin: "scan" },
  ] as import("./types").VoticDocument[];
  expect(sort_documents(documents, "type").map((d) => d.id)).toEqual(["s", "t", "w"]);
});

describe("document type filters", () => {
  it.each([
    ["Report.PDF", undefined, "pdf"],
    ["Essay.DOCX", undefined, "word"],
    ["old.doc", undefined, "word"],
    ["notes.TXT", "file", "text"],
    ["Moon Facts.txt", "webpage", "other"],
    ["Scanned document.txt", "scan", "other"],
    ["README.md", undefined, "other"],
    ["book.epub", undefined, "other"],
    ["letter.rtf", undefined, "other"],
  ] as const)("%s (origin %s) is %s", (sourceName, origin, expected) => {
    expect(document_type_filter({ sourceName, origin })).toBe(expected);
  });

  it("names the filter in its empty message", () => {
    const base = { query: "", finishedOnly: false, collectionLabel: "All documents" };
    expect(empty_filter_message({ ...base, typeFilter: "word" })).toBe("No DOCX files here yet");
    expect(empty_filter_message({ ...base, typeFilter: "pdf", query: " moon " })).toBe(
      "No PDFs match “moon”",
    );
    expect(empty_filter_message({ ...base, typeFilter: "all", query: "moon" })).toBe(
      "No documents match “moon”",
    );
  });
});
