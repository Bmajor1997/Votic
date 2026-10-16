import { describe, expect, it } from "vitest";
import { automatic_note_title, clean_tags, note_type_label } from "./noteMetadata";
describe("note metadata", () => {
  it("creates a concise title from note text", () =>
    expect(
      automatic_note_title({
        note: "Memory improves with chunking. More detail.",
        text: "",
        title: undefined,
      }),
    ).toBe("Memory improves with chunking"));
  it("keeps an explicit title", () =>
    expect(automatic_note_title({ note: "Body", text: "Source", title: "Exam review" })).toBe("Exam review"));
  it("defaults old notes to Note", () => expect(note_type_label()).toBe("Note"));
  it("cleans, deduplicates, and limits tags", () =>
    expect(clean_tags("exam, memory, exam, cognition")).toEqual(["exam", "memory", "cognition"]));
});
