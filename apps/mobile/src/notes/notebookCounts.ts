/**
 * What a notebook holds, in words. A saved passage with a note counts as a note; a saved passage without one is a
 * "saved passage". Only parts that exist are named, so a notebook never reads "1 note · 0 passages".
 */
export function notebook_counts_label(notes: number, savedPassages: number) {
  const parts: string[] = [];
  if (notes > 0) parts.push(`${notes} ${notes === 1 ? "note" : "notes"}`);
  if (savedPassages > 0) parts.push(`${savedPassages} saved ${savedPassages === 1 ? "passage" : "passages"}`);
  return parts.length ? parts.join(" · ") : "No notes yet";
}
