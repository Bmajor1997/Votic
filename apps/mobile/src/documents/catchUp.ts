import { splitPassages } from "./passages";
import { VoticDocument } from "./types";

export function catchUpContext(document: VoticDocument) {
  const passages = splitPassages(document.plainText);
  if (!passages.length) return "";
  const current = Math.max(0, Math.min(passages.length - 1, document.sentenceIndex || 0));
  const start = Math.max(0, current - 5);
  return passages.slice(start, current + 1).join("\n\n").slice(-12000);
}
export function catchUpPrompt(document: VoticDocument) {
  const percent = Math.round((document.progress || 0) * 100);
  return "Catch me up on what I have already covered in this document. I am about " + percent +
    "% through it. Summarize only the material before my current position, in plain language, with one short overview and 3-5 key points. Do not spoil later sections.";
}
