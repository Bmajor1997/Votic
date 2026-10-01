import { describe, expect, it } from "vitest";
import { SavedPassage, VoticDocument } from "../documents/types";
import { advancedFilterCount, availableTags, dateLabel, noteGroups, NotesView, shareText } from "./notesList";

const DAY = 86_400_000;
const NOW = 100 * DAY;
function passage(id: string, extra: Partial<SavedPassage> = {}): SavedPassage {
  return { id, sentenceIndex: 0, text: `Text ${id}.`, note: "", createdAt: 1, updatedAt: NOW, ...extra };
}
function doc(id: string, title: string, savedPassages: SavedPassage[]): VoticDocument {
  return {
    id,
    title,
    sourceName: `${title}.pdf`,
    plainText: "",
    importedAt: 1,
    updatedAt: 1,
    progress: 0,
    sentenceIndex: 0,
    wordIndex: 0,
    playbackRate: 1,
    savedPassages,
  };
}
const documents = [
  doc("psy", "Psychology", [
    passage("a", {
      note: "Chunking helps.",
      noteType: "key-point",
      tags: ["memory"],
      updatedAt: NOW - 2 * DAY,
    }),
    passage("b", { pinned: true, updatedAt: NOW - 40 * DAY }),
  ]),
  doc("bio", "Biology", [passage("c", { note: "Cells divide.", noteType: "question", tags: ["cells"] })]),
  doc("empty", "Empty", []),
];
const all: NotesView = { query: "", filter: "all", dateFilter: "all", tagFilter: null, notebookId: null };
const ids = (view: Partial<NotesView>) =>
  noteGroups(documents, { ...all, ...view }, NOW).map((group) => [
    group.document.id,
    group.passages.map((item) => item.id),
  ]);

describe("note groups", () => {
  it("groups by document, most recent first, and skips documents without matches", () => {
    expect(ids({})).toEqual([
      ["bio", ["c"]],
      ["psy", ["a", "b"]],
    ]);
  });
  it("separates written notes from saved passages", () => {
    expect(ids({ filter: "notes" })).toEqual([
      ["bio", ["c"]],
      ["psy", ["a"]],
    ]);
    expect(ids({ filter: "saved" })).toEqual([["psy", ["b"]]]);
  });
  it("filters by pin, type, and tag", () => {
    expect(ids({ filter: "pinned" })).toEqual([["psy", ["b"]]]);
    expect(ids({ filter: "question" })).toEqual([["bio", ["c"]]]);
    expect(ids({ tagFilter: "memory" })).toEqual([["psy", ["a"]]]);
  });
  it("filters by how recently a note changed", () => {
    expect(ids({ dateFilter: "today" })).toEqual([["bio", ["c"]]]);
    expect(ids({ dateFilter: "week" })).toEqual([
      ["bio", ["c"]],
      ["psy", ["a"]],
    ]);
    expect(ids({ dateFilter: "month" })).toEqual(ids({ dateFilter: "week" }));
  });
  it("searches document titles, text, notes, type labels, and tags, ignoring case", () => {
    expect(ids({ query: "BIOLOGY" })).toEqual([["bio", ["c"]]]);
    expect(ids({ query: "chunking" })).toEqual([["psy", ["a"]]]);
    expect(ids({ query: "key point" })).toEqual([["psy", ["a"]]]);
    expect(ids({ query: "cells" })).toEqual([["bio", ["c"]]]);
    expect(ids({ query: "  " })).toEqual(ids({}));
  });
  it("shows only one document in its notebook, pinned notes first", () => {
    expect(ids({ notebookId: "psy" })).toEqual([["psy", ["b", "a"]]]);
  });
});

describe("filter helpers", () => {
  it("counts every filter that differs from the default of all notes", () => {
    expect(advancedFilterCount({ filter: "all", dateFilter: "all", tagFilter: null })).toBe(0);
    // Notes or Saved passages now live in the filter sheet too.
    expect(advancedFilterCount({ filter: "notes", dateFilter: "all", tagFilter: null })).toBe(1);
    expect(advancedFilterCount({ filter: "pinned", dateFilter: "week", tagFilter: "memory" })).toBe(3);
  });
  it("lists each tag once, sorted", () => {
    expect(availableTags(documents)).toEqual(["cells", "memory"]);
  });
});

describe("sharing and dates", () => {
  it("formats notes for sharing with their source and tags", () => {
    expect(shareText([{ document: documents[1], passage: documents[1].savedPassages![0] }], "My notes")).toBe(
      "My notes\n\n1. Cells divide\nCells divide.\nSource: Biology\nTags: #cells\n\nShared from Votic",
    );
  });
  it("labels today and yesterday", () => {
    const today = new Date(2026, 8, 29, 15);
    expect(dateLabel(new Date(2026, 8, 29, 9).getTime(), today)).toBe("Today");
    expect(dateLabel(new Date(2026, 8, 28, 23).getTime(), today)).toBe("Yesterday");
    expect(dateLabel(new Date(2026, 8, 20).getTime(), today)).not.toMatch(/Today|Yesterday/);
  });
});
