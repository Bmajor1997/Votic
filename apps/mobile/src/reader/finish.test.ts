import { describe, expect, it } from "vitest";
import type { VoticDocument } from "../documents/types";
import { is_finished, next_up } from "./finish";

function doc(id: string, overrides: Partial<VoticDocument> = {}): VoticDocument {
  return {
    id,
    title: id,
    sourceName: `${id}.pdf`,
    plainText: "Text.",
    importedAt: 0,
    updatedAt: 0,
    progress: 0,
    sentenceIndex: 0,
    wordIndex: 0,
    playbackRate: 1,
    ...overrides,
  };
}

describe("is_finished", () => {
  it("is finished only when read to the end and marked complete", () => {
    expect(is_finished(doc("a", { completedAt: 5, progress: 1 }))).toBe(true);
    expect(is_finished(doc("a", { progress: 1 }))).toBe(false);
    // Reopened and started again: back to in progress, finish date kept.
    expect(is_finished(doc("a", { completedAt: 5, progress: 0.2 }))).toBe(false);
  });
});

describe("next_up", () => {
  it("prefers the unfinished document opened most recently", () => {
    const documents = [
      doc("current", { progress: 1, completedAt: 9 }),
      doc("old-start", { progress: 0.3, lastOpenedAt: 10 }),
      doc("recent-start", { progress: 0.5, lastOpenedAt: 20 }),
      doc("new", { importedAt: 30 }),
    ];
    expect(next_up(documents, "current")?.id).toBe("recent-start");
  });

  it("falls back to the newest document not started, and skips finished ones and the current one", () => {
    const documents = [
      doc("current", { progress: 0.4, lastOpenedAt: 50 }),
      doc("done", { progress: 1, completedAt: 3, lastOpenedAt: 40 }),
      doc("older", { importedAt: 1 }),
      doc("newer", { importedAt: 2 }),
    ];
    expect(next_up(documents, "current")?.id).toBe("newer");
  });

  it("never suggests the Quick Notes notebook, and is null when nothing is left", () => {
    const documents = [doc("current"), doc("notes", { notebookKind: "quick-notes", importedAt: 99 })];
    expect(next_up(documents, "current")).toBeNull();
  });
});
