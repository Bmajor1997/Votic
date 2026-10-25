import { split_passages } from "../documents/passages";
import { SECTION_TARGET_CHARS, question_terms, type AskLink } from "./documentSections";
import { passage_heading } from "./passageHeading";
import { quote_passage } from "./quotePassage";

/**
 * Where an Ask Votic answer points in the Reader, shared by the Reader's Ask panel and the full-screen Ask Votic so
 * both show the same passage chip. The section link is narrowed to the passage holding the quoted sentence, and the
 * nearest heading names it. When the quote can't be found, the passage in that section sharing the most words with the
 * answer is used, because a section is a ~3,000-character chunk whose start can be paragraphs (and a heading) away
 * from the answer. When the linked document isn't among `documents`, the section link is kept as it is.
 */
export function answer_passage(
  sectionLink: AskLink | null | undefined,
  quote: string | null | undefined,
  documents: readonly { id: string; plainText: string }[],
  answer = "",
): { link?: AskLink; sectionTitle?: string } {
  if (!sectionLink) return {};
  const document = documents.find((item) => item.id === sectionLink.documentId);
  if (!document) return { link: sectionLink };
  const exact = quote_passage(document.plainText, quote, sectionLink.sentenceIndex);
  const best = exact ?? closest_passage(document.plainText, sectionLink.sentenceIndex, answer);
  const link = best !== null ? { ...sectionLink, sentenceIndex: best } : sectionLink;
  return { link, sectionTitle: passage_heading(document.plainText, link.sentenceIndex) ?? undefined };
}

/** Within the section starting at `start`, the passage sharing the most distinct answer words (at least two), or null. */
function closest_passage(plainText: string, start: number, answer: string) {
  const terms = question_terms(answer);
  if (terms.length < 2) return null;
  const passages = split_passages(plainText);
  let best: number | null = null,
    bestScore = 1,
    size = 0;
  for (let index = start; index < passages.length && size <= SECTION_TARGET_CHARS; index++) {
    const text = passages[index].toLocaleLowerCase();
    size += passages[index].length + 1;
    const score = terms.filter((term) => text.includes(term)).length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return best;
}
