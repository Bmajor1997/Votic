import { splitPassages } from "../documents/passages";

export type ComprehensionQuestion = { id: string; prompt: string; answerHint: string; sourceIndex: number };
const meaningful = (text: string) => text.replace(/\s+/g, " ").trim();

export function buildComprehensionQuestions(text: string, position = 1): ComprehensionQuestion[] {
  const passages = splitPassages(text)
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

export function selfCheckFeedback(answer: string, source: string) {
  const words = (value: string) =>
    new Set(
      (value.toLocaleLowerCase().match(/[a-z0-9']{4,}/g) || []).filter(
        (w) =>
          ![
            "that",
            "this",
            "with",
            "from",
            "have",
            "were",
            "their",
            "about",
            "would",
            "there",
            "which",
          ].includes(w),
      ),
    );
  const expected = words(source),
    actual = words(answer);
  let overlap = 0;
  for (const word of actual) if (expected.has(word)) overlap += 1;
  if (answer.trim().length < 20)
    return "Add a little more detail, then compare your answer with the passage.";
  if (overlap >= 3) return "Good recall. Your answer includes several ideas from the passage.";
  return "You have the start of it. Revisit the passage and check the main idea and one supporting detail.";
}
