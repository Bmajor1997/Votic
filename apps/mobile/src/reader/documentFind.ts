export type DocumentMatch = { passage: number; offset: number; length: number };
/** Unicode simple-case comparison without expanding one character into several (e.g. ß into ss). */
const QUOTES: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201b": "'",
  "\u2032": "'",
  "\u02bc": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u201e": '"',
  "\u2033": '"',
};
function fold_character(character: string) {
  // Typed straight quotes find the curly ones PDFs and books use ("don't" finds "don’t"), one character for one.
  if (QUOTES[character]) return QUOTES[character];
  if (character <= "\x7f") return character >= "A" && character <= "Z" ? character.toLowerCase() : character;
  // Default Unicode matching keeps dotless i distinct from ASCII i/I.
  if (character === "ı") return character;
  const upper = character.toUpperCase();
  const lower = (Array.from(upper).length === 1 ? upper : character).toLowerCase();
  return Array.from(lower).length === 1 ? lower : character;
}

/** Prefix lengths let literal search advance linearly even for repeated near-matches. */
function prefix_lengths(pattern: string[]) {
  const lengths = new Array<number>(pattern.length).fill(0);
  let matched = 0;
  for (let index = 1; index < pattern.length; index++) {
    while (matched > 0 && pattern[index] !== pattern[matched]) matched = lengths[matched - 1];
    if (pattern[index] === pattern[matched]) matched++;
    lengths[index] = matched;
  }
  return lengths;
}

/** Literal, case-insensitive code-point search. No query is compiled or executed as a regular expression. */
export function literal_matches(text: string, query: string, max = 1000) {
  if (!query || max <= 0) return [];
  const pattern = Array.from(query, fold_character);
  const prefixes = prefix_lengths(pattern);
  const starts = new Array<number>(pattern.length);
  const matches: { offset: number; length: number }[] = [];
  let matched = 0,
    offset = 0,
    seen = 0;
  for (const character of text) {
    starts[seen % pattern.length] = offset;
    const folded = fold_character(character);
    while (matched > 0 && folded !== pattern[matched]) matched = prefixes[matched - 1];
    if (folded === pattern[matched]) matched++;
    offset += character.length;
    seen++;
    if (matched !== pattern.length) continue;
    const start = starts[(seen - pattern.length) % pattern.length];
    matches.push({ offset: start, length: offset - start });
    if (matches.length >= max) break;
    matched = 0; // Preserve non-overlapping matches and original UTF-16 highlight offsets.
  }
  return matches;
}
/** Yields between small batches and can be canceled when the query or document changes. */
export async function find_document_matches(passages: string[], query: string, canceled: () => boolean) {
  if (!query) return [];
  const matches: DocumentMatch[] = [];
  for (let index = 0; index < passages.length; index += 1) {
    if (canceled()) return [];
    for (const match of literal_matches(passages[index], query, 1001 - matches.length))
      matches.push({ passage: index, ...match });
    if (matches.length >= 1001) break;
    if (index % 32 === 31) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return matches;
}

/** The words around a match, so a screen reader can say what was found and not only where it is in the list. */
export function match_context(text: string, match: { offset: number; length: number }, radius = 60) {
  const start = Math.max(0, match.offset - radius);
  const end = Math.min(text.length, match.offset + match.length + radius);
  const nextSpace = text.indexOf(" ", start);
  const from = start > 0 && nextSpace >= start && nextSpace < match.offset ? nextSpace + 1 : start;
  const lastSpace = text.lastIndexOf(" ", end);
  const to = end === text.length || lastSpace <= match.offset + match.length ? end : lastSpace;
  return `${from > 0 ? "…" : ""}${text.slice(from, to).replace(/\s+/g, " ").trim()}${to < text.length ? "…" : ""}`;
}
