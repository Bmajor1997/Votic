export type DocumentMatch = { passage: number; offset: number; length: number };
/** Literal matching: punctuation is never evaluated as a user-supplied regular expression. */
export function literal_matches(text: string, query: string, max = 1000) {
  if (!query) return [];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "giu");
  const matches: { offset: number; length: number }[] = [];
  let result: RegExpExecArray | null;
  while ((result = pattern.exec(text)) && matches.length < max)
    matches.push({ offset: result.index, length: result[0].length });
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
