import type { AskLink } from "./documentSections";
import { passage_heading } from "./passageHeading";
import { quote_passage } from "./quotePassage";

/**
 * Where an Ask Votic answer points in the Reader, shared by the Reader's Ask panel and the full-screen Ask Votic so
 * both show the same passage chip. The section link is narrowed to the passage holding the quoted sentence, and the
 * nearest heading names it. When the linked document isn't among `documents`, the section link is kept as it is.
 */
export function answer_passage(
  sectionLink: AskLink | null | undefined,
  quote: string | null | undefined,
  documents: readonly { id: string; plainText: string }[],
): { link?: AskLink; sectionTitle?: string } {
  if (!sectionLink) return {};
  const document = documents.find((item) => item.id === sectionLink.documentId);
  if (!document) return { link: sectionLink };
  const exact = quote_passage(document.plainText, quote, sectionLink.sentenceIndex);
  const link = exact !== null ? { ...sectionLink, sentenceIndex: exact } : sectionLink;
  return { link, sectionTitle: passage_heading(document.plainText, link.sentenceIndex) ?? undefined };
}
