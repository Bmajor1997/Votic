import { describe, expect, it } from "vitest";
import { chunk_document, question_terms, select_sections } from "./documentSections";
import { split_passages } from "../documents/passages";

describe("document sections", () => {
  const text = Array.from(
    { length: 100 },
    (_, index) => `This is sentence number ${index + 1} of the test.`,
  ).join(" ");
  it("covers every passage exactly once, in order, within the size target", () => {
    const sections = chunk_document("doc", text, 500);
    expect(sections.map((item) => item.section.text).join(" ")).toBe(split_passages(text).join(" "));
    expect(sections.every((item) => item.section.text.length <= 500)).toBe(true);
  });
  it("links each section to the Reader passage where it starts", () => {
    const passages = split_passages(text);
    for (const { section, link } of chunk_document("doc", text, 500)) {
      expect(link?.documentId).toBe("doc");
      expect(section.text.startsWith(passages[link!.sentenceIndex])).toBe(true);
      expect(section.heading).toMatch(new RegExp(`^Passages? ${link!.sentenceIndex + 1}`));
    }
  });
  it("splits a passage with no sentence punctuation into bounded pieces", () => {
    const sections = chunk_document("doc", "word ".repeat(2000).trim(), 1000);
    expect(sections.length).toBeGreaterThan(5);
    expect(sections.every((item) => item.section.text.length <= 1000 && item.link?.sentenceIndex === 0)).toBe(
      true,
    );
    expect(sections[1].section.heading).toBe("Passage 1 (continued)");
  });
  it("returns nothing for an empty document", () => {
    expect(chunk_document("doc", "")).toEqual([]);
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
    expect(select_sections(items, "anything", { budgetChars: 1_000_000, maxSections: 100 })).toEqual({
      items,
      partial: false,
    });
  });
  it("prefers sections matching the question and keeps document order", () => {
    const { items: chosen, partial } = select_sections(items, "When was the Westphalia treaty?", {
      budgetChars: 1500,
    });
    expect(partial).toBe(true);
    expect(chosen).toContain(items[37]);
    const indexes = chosen.map((item) => items.indexOf(item));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });
  it("always includes the reading position", () => {
    expect(select_sections(items, "Westphalia", { budgetChars: 1000, anchorIndex: 4 }).items).toContain(
      items[4],
    );
  });
  it("spreads a broad question across the whole document", () => {
    const indexes = select_sections(items, "Summarize this document", { budgetChars: 2000 }).items.map(
      (item) => items.indexOf(item),
    );
    expect(Math.min(...indexes)).toBeLessThan(10);
    expect(Math.max(...indexes)).toBeGreaterThan(40);
  });
  it("respects the section limit", () => {
    expect(select_sections(items, "farming", { budgetChars: 1_000_000, maxSections: 5 }).items).toHaveLength(
      5,
    );
  });
  it("keeps a bounded excerpt when one selected section exceeds the context budget", () => {
    const oversized = {
      section: { heading: "Saved passage", text: "important context ".repeat(5000) },
    };
    const result = select_sections([oversized], "What does this passage say?", {
      budgetChars: 1000,
      maxSections: 5,
    });
    expect(result.partial).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].section.text.length).toBeGreaterThan(0);
    expect(result.items[0].section.heading.length + result.items[0].section.text.length).toBeLessThanOrEqual(
      1000,
    );
  });
  it("ignores filler words in questions", () => {
    expect(question_terms("What does the document say about Photosynthesis?")).toEqual([
      "say",
      "photosynthesis",
    ]);
  });
});
