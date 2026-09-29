import { describe, expect, it } from "vitest";
import { chunkDocument, questionTerms, selectSections } from "./documentSections";
import { splitPassages } from "../documents/passages";

describe("document sections", () => {
  const text = Array.from(
    { length: 100 },
    (_, index) => `This is sentence number ${index + 1} of the test.`,
  ).join(" ");
  it("covers every passage exactly once, in order, within the size target", () => {
    const sections = chunkDocument("doc", text, 500);
    expect(sections.map((item) => item.section.text).join(" ")).toBe(splitPassages(text).join(" "));
    expect(sections.every((item) => item.section.text.length <= 500)).toBe(true);
  });
  it("links each section to the Reader passage where it starts", () => {
    const passages = splitPassages(text);
    for (const { section, link } of chunkDocument("doc", text, 500)) {
      expect(link?.documentId).toBe("doc");
      expect(section.text.startsWith(passages[link!.sentenceIndex])).toBe(true);
      expect(section.heading).toMatch(new RegExp(`^Passages? ${link!.sentenceIndex + 1}`));
    }
  });
  it("splits a passage with no sentence punctuation into bounded pieces", () => {
    const sections = chunkDocument("doc", "word ".repeat(2000).trim(), 1000);
    expect(sections.length).toBeGreaterThan(5);
    expect(sections.every((item) => item.section.text.length <= 1000 && item.link?.sentenceIndex === 0)).toBe(
      true,
    );
    expect(sections[1].section.heading).toBe("Passage 1 (continued)");
  });
  it("returns nothing for an empty document", () => {
    expect(chunkDocument("doc", "")).toEqual([]);
  });
});

describe("section selection", () => {
  const items = Array.from({ length: 50 }, (_, index) => ({
    section: {
      heading: `S${index}`,
      text:
        index === 37
          ? "The treaty of Westphalia ended the war."
          : `Filler section ${index} about farming and weather.`.padEnd(200, "."),
    },
  }));
  it("keeps everything when it fits", () => {
    expect(selectSections(items, "anything", { budgetChars: 1_000_000, maxSections: 100 })).toEqual({
      items,
      partial: false,
    });
  });
  it("prefers sections matching the question and keeps document order", () => {
    const { items: chosen, partial } = selectSections(items, "When was the Westphalia treaty?", {
      budgetChars: 1500,
    });
    expect(partial).toBe(true);
    expect(chosen).toContain(items[37]);
    const indexes = chosen.map((item) => items.indexOf(item));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });
  it("always includes the reading position", () => {
    expect(selectSections(items, "Westphalia", { budgetChars: 1000, anchorIndex: 4 }).items).toContain(
      items[4],
    );
  });
  it("spreads a broad question across the whole document", () => {
    const indexes = selectSections(items, "Summarize this document", { budgetChars: 2000 }).items.map(
      (item) => items.indexOf(item),
    );
    expect(Math.min(...indexes)).toBeLessThan(10);
    expect(Math.max(...indexes)).toBeGreaterThan(40);
  });
  it("respects the section limit", () => {
    expect(selectSections(items, "farming", { budgetChars: 1_000_000, maxSections: 5 }).items).toHaveLength(
      5,
    );
  });
  it("ignores filler words in questions", () => {
    expect(questionTerms("What does the document say about Photosynthesis?")).toEqual([
      "say",
      "photosynthesis",
    ]);
  });
});
