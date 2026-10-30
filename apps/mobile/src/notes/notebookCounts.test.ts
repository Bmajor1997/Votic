import { describe, expect, it } from "vitest";
import { notebook_counts_label } from "./notebookCounts";

describe("notebook_counts_label", () => {
  it("names only what the notebook holds", () => {
    expect(notebook_counts_label(1, 0)).toBe("1 note");
    expect(notebook_counts_label(0, 1)).toBe("1 saved passage");
    expect(notebook_counts_label(2, 3)).toBe("2 notes · 3 saved passages");
  });

  it("says when a notebook is empty", () => {
    expect(notebook_counts_label(0, 0)).toBe("No notes yet");
  });
});
