/**
 * Markdown marks that should never be shown or spoken: heading hashes, bold/underline markers, and quote
 * markers. None contain sentence punctuation, so removing them never moves passage numbers.
 */
function withoutMarkdownMarks(text: string) {
  return text
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, "$1")
    .replace(/__(?=\S)([^_\n]+?)__/g, "$1");
}

/** Words that end with a period without ending the sentence ("e.g.", "Dr.", "vs."). */
const ABBREVIATIONS = new Set([
  "e.g",
  "i.e",
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "fig",
  "no",
  "approx",
]);
function endsWithAbbreviation(text: string, end: number) {
  // Inspect only the preceding word, rather than rescanning the entire passage for each period.
  let start = end;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  const word = text.slice(start, end);
  // A single capital letter is an initial ("J. K. Rowling").
  return ABBREVIATIONS.has(word.toLowerCase()) || /^[A-Z]$/.test(word);
}

/**
 * Splits document text into the passages the Reader shows and counts ("passage N" = index N-1).
 * A passage ends at a blank line (so a heading stands on its own) or at sentence punctuation followed by a
 * space, so "Vice.com", "2.5", and dates like "12.10.26" stay in one passage.
 */
export function splitPassages(text: string) {
  const passages: string[] = [];
  const add = (value: string) => {
    const clean = value.trim();
    if (clean) passages.push(clean);
  };
  for (const paragraph of withoutMarkdownMarks(text.replace(/\r\n?/g, "\n")).split(/\n[ \t]*\n/)) {
    const ending = /[.!?]+[\]"')\u2019\u201d]*(?=\s|$)/g;
    let start = 0;
    for (let match = ending.exec(paragraph); match; match = ending.exec(paragraph)) {
      if (match[0].startsWith(".") && match[0].length === 1 && endsWithAbbreviation(paragraph, match.index))
        continue;
      const end = match.index + match[0].length;
      add(paragraph.slice(start, end));
      start = end;
    }
    add(paragraph.slice(start));
  }
  return passages;
}
