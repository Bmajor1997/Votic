import { describe, expect, it } from "vitest";
import { automaticNoteTitle, cleanTags, noteTypeLabel } from "./noteMetadata";
describe("note metadata", () => {
  it("creates a concise title from note text", () =>
    expect(
      automaticNoteTitle({ note: "Memory improves with chunking. More detail.", text: "", title: undefined }),
    ).toBe("Memory improves with chunking"));
  it("keeps an explicit title", () =>
    expect(automaticNoteTitle({ note: "Body", text: "Source", title: "Exam review" })).toBe("Exam review"));
  it("defaults old notes to Note", () => expect(noteTypeLabel()).toBe("Note"));
  it("cleans, deduplicates, and limits tags", () =>
    expect(cleanTags("exam, memory, exam, cognition")).toEqual(["exam", "memory", "cognition"]));
});
