import { describe, expect, it } from "vitest";
import { split_passages } from "../documents/passages";
import { answer_passage } from "./answerPassage";

const plainText = [
  "Circulatory system",
  "The systemic heart has muscular contractile walls and consists of a single ventricle and two atria.",
  "The blood vessels consist of arteries, capillaries and veins.",
  "Nervous system and senses",
  "Octopuses have a complex nervous system containing over 500 million neurons.",
  "Two-thirds of the neurons are in the nerve cords of its arms.",
].join("\n\n");
const document = { id: "octopus", plainText };
const section = { documentId: "octopus", sentenceIndex: 0 };
const index_of = (text: string) => split_passages(plainText).findIndex((passage) => passage.includes(text));

describe("answer_passage", () => {
  it("links to the quoted sentence when the quote is found", () => {
    const { link } = answer_passage(section, "The blood vessels consist of arteries", [document]);
    expect(link?.sentenceIndex).toBe(index_of("blood vessels"));
  });
  it("without a usable quote, links to the passage in the section that matches the answer, not the section's start", () => {
    const { link, sectionTitle } = answer_passage(
      section,
      null,
      [document],
      "About two-thirds of its neurons are in its arms.",
    );
    expect(link?.sentenceIndex).toBe(index_of("Two-thirds"));
    expect(sectionTitle).toBe("Nervous system and senses");
  });
  it("keeps the section's start when nothing in the section matches the answer", () => {
    const { link } = answer_passage(section, null, [document], "The document does not say.");
    expect(link?.sentenceIndex).toBe(0);
  });
});
