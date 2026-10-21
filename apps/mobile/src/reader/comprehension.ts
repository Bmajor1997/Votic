import { split_passages } from "../documents/passages";

/** The three questions, by stable kind. The server grades each kind against its own question text. */
export type QuestionKind = "main-point" | "supporting-detail" | "explain-it";
export type ComprehensionQuestion = { id: QuestionKind; prompt: string };
export const COMPREHENSION_QUESTIONS: ComprehensionQuestion[] = [
  { id: "main-point", prompt: "In your own words, what is the main point of this part?" },
  { id: "supporting-detail", prompt: "What important detail supports the main idea?" },
  { id: "explain-it", prompt: "What would you tell someone who has not read this yet?" },
];
/** The most text sent for grading, matching the server's limit. The most recent reading is kept. */
export const MAX_SOURCE_CHARS = 12_000;
const MIN_SOURCE_CHARS = 45;

/**
 * The part of the document read so far, which every answer is graded against. Questions no longer point at single
 * sentences picked by position (which matched "main point" with whatever sentence came last), and nothing past the
 * reader's position is included, so checking never spoils what comes next.
 */
export function understanding_source(text: string, position = 1) {
  const passages = split_passages(text).map((passage) => passage.replace(/\s+/g, " ").trim());
  if (!passages.length) return "";
  const end = Math.max(
    1,
    Math.min(passages.length, Math.ceil(passages.length * Math.max(0.05, Math.min(1, position)))),
  );
  let source = "";
  for (let index = end - 1; index >= 0; index -= 1) {
    const next = source ? `${passages[index]} ${source}` : passages[index];
    if (next.length > MAX_SOURCE_CHARS) break;
    source = next;
  }
  return source.length >= MIN_SOURCE_CHARS ? source : "";
}
