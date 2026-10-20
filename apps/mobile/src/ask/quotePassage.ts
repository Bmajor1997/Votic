import { split_passages } from "../documents/passages";

/** A passage shorter than this is too generic ("Yes.") to match part of a quote on its own. */
const MIN_PARTIAL_CHARS = 20;

const key = (text: string) =>
  text.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

/**
 * The Reader passage ("passage N" = index N-1) that holds the sentence an answer rests on. It looks from the start of
 * the section the answer came from, then anywhere earlier. A quote that runs across passages matches its first one.
 * Returns null when the sentence can't be found, so the caller keeps the section's own link.
 */
export function quote_passage(
  plainText: string,
  quote: string | null | undefined,
  fromIndex = 0,
): number | null {
  const wanted = quote ? key(quote) : "";
  if (!wanted) return null;
  const passages = split_passages(plainText).map(key);
  const start = Math.min(Math.max(0, fromIndex), passages.length);
  const order = [...passages.keys()].slice(start).concat([...passages.keys()].slice(0, start));
  for (const index of order) if (passages[index].includes(wanted)) return index;
  for (const index of order) {
    const passage = passages[index];
    if (passage.length >= MIN_PARTIAL_CHARS && wanted.includes(passage)) return index;
  }
  return null;
}
