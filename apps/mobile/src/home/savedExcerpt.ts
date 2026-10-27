/** Invalid checkpoints get an honest fallback rather than a misleading excerpt from another location. */
export function saved_excerpt(passages: string[], sentenceIndex: number, wordIndex: number) {
  if (
    !Number.isInteger(sentenceIndex) ||
    sentenceIndex < 0 ||
    sentenceIndex >= passages.length ||
    !Number.isInteger(wordIndex) ||
    wordIndex < 0
  )
    return null;
  const passage = passages[sentenceIndex];
  const words = [...passage.matchAll(/\S+/g)];
  if (wordIndex >= words.length) return null;
  // Include a little context before the saved word, then the following passage if there is room.
  const start = words[Math.max(0, wordIndex - 6)].index!;
  return (passage.slice(start, start + 460) + " " + (passages[sentenceIndex + 1] || "").slice(0, 460))
    .trim()
    .slice(0, 460);
}
