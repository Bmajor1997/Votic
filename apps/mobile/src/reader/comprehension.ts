import { split_passages } from "../documents/passages";

export type ComprehensionQuestion = { id: string; prompt: string; answerHint: string; sourceIndex: number };
const meaningful = (text: string) => text.replace(/\s+/g, " ").trim();

export function build_comprehension_questions(text: string, position = 1): ComprehensionQuestion[] {
  const passages = split_passages(text)
    .map(meaningful)
    .filter((p) => p.length >= 45);
  if (!passages.length) return [];
  const end = Math.max(
    1,
    Math.min(passages.length, Math.ceil(passages.length * Math.max(0.05, Math.min(1, position)))),
  );
  const read = passages.slice(0, end);
  const indexes = [...new Set([Math.max(0, read.length - 1), Math.floor((read.length - 1) / 2), 0])];
  const labels = [
    "In your own words, what is the main point of this part?",
    "What important detail supports the main idea?",
    "What would you tell someone who has not read this yet?",
  ];
  return indexes.slice(0, 3).map((sourceIndex, i) => ({
    id: "understanding-" + sourceIndex + "-" + i,
    prompt: labels[i],
    answerHint: read[sourceIndex],
    sourceIndex,
  }));
}
