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

/** Splits document text into the passages the Reader shows and counts ("passage N" = index N-1). */
export function splitPassages(text: string) {
  return (
    withoutMarkdownMarks(text)
      .match(/[^.!?]+[.!?]+[\]"')]*|[^.!?]+$/g)
      ?.map((value) => value.trim())
      .filter(Boolean) || []
  );
}
