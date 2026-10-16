import { split_passages } from "./passages";
import { VoticDocument } from "./types";

export function catch_up_context(document: VoticDocument) {
  const passages = split_passages(document.plainText);
  if (!passages.length) return "";
  const current = Math.max(0, Math.min(passages.length - 1, document.sentenceIndex || 0));
  const start = Math.max(0, current - 5);
  return passages
    .slice(start, current + 1)
    .join("\n\n")
    .slice(-12000);
}
export function catch_up_prompt(document: VoticDocument) {
  const percent = Math.round((document.progress || 0) * 100);
  return (
    "Catch me up on what I have already covered in this document. I am about " +
    percent +
    '% through it. In two or three short, plain sentences, remind me where I left off: start with "You were reading about", then say what the most recent part covered. Write it as a short paragraph, with no bullet points, headings, or lists, so it reads as a reminder rather than a summary. Cover only the material before my current position and do not spoil later sections.'
  );
}
