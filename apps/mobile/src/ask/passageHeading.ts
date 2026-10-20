import { split_passages } from "../documents/passages";

/** A heading stands alone as its own passage: short, and not ending like a sentence. */
const MAX_HEADING_CHARS = 60;
const MAX_HEADING_WORDS = 8;
/** How far past the passage to look when nothing above it is a heading (a title line often comes first). */
const LOOK_AHEAD = 3;

function is_heading(passage: string) {
  const text = passage.trim();
  return (
    text.length > 0 &&
    text.length <= MAX_HEADING_CHARS &&
    text.split(/\s+/).length <= MAX_HEADING_WORDS &&
    !/[.!?:;,]["')\]’”]*$/.test(text)
  );
}

/**
 * The name of the part of a document a passage belongs to, such as "Job Description": the nearest heading at or
 * above it, or else one just after it. Returns null when the document has no heading nearby, so the caller can
 * fall back to the document's title instead of inventing a name.
 */
export function passage_heading(plainText: string, passageIndex: number): string | null {
  const passages = split_passages(plainText);
  if (passageIndex < 0 || passageIndex >= passages.length) return null;
  for (let index = passageIndex; index >= 0; index -= 1)
    if (is_heading(passages[index])) return passages[index];
  const last = Math.min(passages.length - 1, passageIndex + LOOK_AHEAD);
  for (let index = passageIndex + 1; index <= last; index += 1)
    if (is_heading(passages[index])) return passages[index];
  return null;
}
