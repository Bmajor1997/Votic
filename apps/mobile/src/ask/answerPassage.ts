import type { AskLink } from "./documentSections";
import { passage_heading } from "./passageHeading";
import { quote_passage } from "./quotePassage";

/**
 * Where an Ask Votic answer points in the Reader, shared by the Reader's Ask panel and the full-screen Ask Votic so
 * both show the same passage chip. The section link is narrowed to the passage holding the quoted sentence, and the
 * nearest heading names it. Without the linked document's text, the section link is kept as it is.
 */
export function answer_passage(
  sectionLink: AskLink | undefined,
  quote: string | null | undefined,
  document: { id: string; plainText: string } | null | undefined,
): { link?: AskLink; sectionTitle?: string } {
  if (!sectionLink) return {};
  if (!document || document.id !== sectionLink.documentId) return { link: sectionLink };
  const exact = quote_passage(document.plainText, quote, sectionLink.sentenceIndex);
  const link = exact !== null ? { ...sectionLink, sentenceIndex: exact } : sectionLink;
  return { link, sectionTitle: passage_heading(document.plainText, link.sentenceIndex) ?? undefined };
}
