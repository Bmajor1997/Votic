import { describe, expect, it } from "vitest";
import { split_passages } from "../documents/passages";
import { saved_excerpt } from "./savedExcerpt";
describe("saved position excerpts", () => {
  it("uses Reader passage boundaries and includes context around the saved word", () => {
    const passages = split_passages(
      "The beginning.\n\nWe left off right here in the second paragraph. Next sentence.",
    );
    expect(saved_excerpt(passages, 1, 4)).toBe(
      "We left off right here in the second paragraph. Next sentence.",
    );
    expect(saved_excerpt(passages, 1, 4)).not.toContain("The beginning");
  });
  it("falls back for absent text and invalid checkpoints", () => {
    for (const position of [-1, 4, NaN, 0.5]) expect(saved_excerpt(["Hello world"], position, 0)).toBeNull();
    expect(saved_excerpt([], 0, 0)).toBeNull();
    expect(saved_excerpt(["Hello"], 0, 5)).toBeNull();
  });
  it("bounds long excerpts and starts near a later saved word", () => {
    expect(saved_excerpt(["word ".repeat(1000)], 0, 900)?.length).toBeLessThanOrEqual(460);
    expect(saved_excerpt(["old ".repeat(20) + "new ".repeat(20)], 0, 30)).not.toContain("old");
  });
});
