import { describe, expect, it, vi } from "vitest";
import { find_duplicate_import } from "./useImportSave";
import { VoticDocument } from "./types";

vi.mock("react-native", () => ({ Alert: { alert: vi.fn() } }));
vi.mock("../motion/MotionFeedback", () => ({ useMotionFeedback: () => ({ show: vi.fn() }) }));
vi.mock("./DocumentLibraryProvider", () => ({ useDocumentLibrary: () => ({}) }));
vi.mock("./OcrReviewProvider", () => ({ useOcrReview: () => ({}) }));

const doc = (fields: Partial<VoticDocument>): VoticDocument => ({
  id: "a",
  title: "Notes",
  sourceName: "notes.txt",
  plainText: "Same text.",
  importedAt: 1,
  updatedAt: 1,
  progress: 0,
  sentenceIndex: 0,
  wordIndex: 0,
  playbackRate: 1,
  ...fields,
});

describe("find_duplicate_import", () => {
  it("finds a live document with the same file name and text", () => {
    expect(find_duplicate_import([doc({})], "notes.txt", "  Same text.\n")?.id).toBe("a");
  });

  it("ignores different text, a different name, deleted documents and Quick Notes", () => {
    expect(find_duplicate_import([doc({})], "notes.txt", "Other text.")).toBeUndefined();
    expect(find_duplicate_import([doc({})], "other.txt", "Same text.")).toBeUndefined();
    expect(find_duplicate_import([doc({ deletedAt: 5 })], "notes.txt", "Same text.")).toBeUndefined();
    expect(
      find_duplicate_import([doc({ notebookKind: "quick-notes" })], "notes.txt", "Same text."),
    ).toBeUndefined();
  });
});
