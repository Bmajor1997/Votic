import type { TextStyle } from "react-native";
import type { ReaderFont, ReadingSpacing, TextSize } from "../accessibility/AccessibilityProvider";

/** Words in a passage, with their character offsets (used to follow speech word by word). */
export function wordMatches(text: string) {
  return [...text.matchAll(/\S+/g)];
}

/** The passage and word at a 0–1 position through the document, measured in words. */
export function locationForProgress(passages: string[], progress: number) {
  const counts = passages.map((passage) => wordMatches(passage).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return { sentenceIndex: 0, wordIndex: 0 };
  let target = Math.min(total - 1, Math.max(0, Math.floor(Math.max(0, Math.min(1, progress)) * total)));
  for (let sentenceIndex = 0; sentenceIndex < counts.length; sentenceIndex += 1) {
    if (target < counts[sentenceIndex]) return { sentenceIndex, wordIndex: target };
    target -= counts[sentenceIndex];
  }
  return {
    sentenceIndex: Math.max(0, passages.length - 1),
    wordIndex: Math.max(0, counts[counts.length - 1] - 1),
  };
}

/** The 0–1 position of a passage and word: 0 at the first word, 1 at the last. */
/** Where the reading line sits in the viewport, the same place the Reader scrolls a resumed passage to. */
export const READING_LINE = 0.45;

/**
 * Read mode's position from the scroll offset: the passage and word under the reading line. At the
 * very top the line starts at the first word, and at the end of the document it reaches the last
 * word, so progress runs from 0% to 100% as someone scrolls.
 */
export function locationAtScroll(
  passages: string[],
  layouts: Record<number, { y: number; height: number }>,
  scroll: { offset: number; viewport: number; contentHeight: number },
) {
  if (!passages.length || !scroll.viewport) return null;
  const last = passages.length - 1;
  if (scroll.contentHeight > 0 && scroll.offset + scroll.viewport >= scroll.contentHeight - 4)
    return { sentenceIndex: last, wordIndex: Math.max(0, wordMatches(passages[last]).length - 1) };
  const offset = Math.max(0, scroll.offset);
  // The line eases down from the top edge, so a document scrolled to the top reads as 0%.
  const line = offset + Math.min(offset, scroll.viewport * READING_LINE);
  let found: { sentenceIndex: number; wordIndex: number } | null = null;
  for (let index = 0; index <= last; index += 1) {
    const layout = layouts[index];
    if (!layout) continue;
    if (layout.y > line) break;
    const words = Math.max(1, wordMatches(passages[index]).length);
    const within = layout.height ? Math.max(0, Math.min(1, (line - layout.y) / layout.height)) : 0;
    found = { sentenceIndex: index, wordIndex: Math.min(words - 1, Math.floor(within * words)) };
  }
  return found ?? { sentenceIndex: 0, wordIndex: 0 };
}

export function progressForLocation(passages: string[], sentenceIndex: number, wordIndex: number) {
  const counts = passages.map((passage) => wordMatches(passage).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 1) return total ? 1 : 0;
  const before = counts.slice(0, Math.max(0, sentenceIndex)).reduce((sum, count) => sum + count, 0);
  const current = Math.min(Math.max(0, wordIndex), Math.max(0, (counts[sentenceIndex] || 1) - 1));
  return Math.max(0, Math.min(1, (before + current) / (total - 1)));
}

/** The part of a passage to speak when resuming from a word, and where it starts. */
export function speechSegment(text: string, startWord: number) {
  const words = wordMatches(text);
  const safe = Math.max(0, Math.min(startWord, Math.max(0, words.length - 1)));
  const start = words[safe]?.index ?? 0;
  return { text: text.slice(start), startChar: start, startWord: safe, words };
}

/**
 * The passage word being spoken at a TTS word boundary. `charIndex` is relative to `segment.text`
 * (iOS and Android both report offsets into the exact string that was spoken).
 */
export function wordAtSpeechOffset(segment: ReturnType<typeof speechSegment>, charIndex: number) {
  if (!Number.isFinite(charIndex)) return null;
  const sourceOffset = segment.startChar + Math.max(0, charIndex);
  let word = segment.startWord;
  for (let i = segment.startWord; i < segment.words.length; i += 1) {
    if ((segment.words[i].index ?? 0) > sourceOffset) break;
    word = i;
  }
  return word;
}

/** A passage split for display. Words are numbered exactly like `wordMatches`; whitespace has `word: null`. */
export function passageTokens(text: string) {
  let word = -1;
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((token) => ({ text: token, word: /^\s+$/.test(token) ? null : (word += 1) }));
}

export function timeSpentLabel(seconds: number) {
  if (seconds < 30) return "<1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function clockLabel(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

/** Text style for the document body from the reader's text preferences. */
export function readerType(
  textSize: TextSize,
  readingSpacing: ReadingSpacing,
  readerFont: ReaderFont,
  textSpacing: "default" | "wide",
): TextStyle {
  const fontSize = textSize === "extra-large" ? 25 : textSize === "large" ? 21 : 18;
  const lineScale = readingSpacing === "extra" ? 1.9 : readingSpacing === "compact" ? 1.42 : 1.65;
  return {
    fontSize,
    lineHeight: Math.round(fontSize * lineScale),
    letterSpacing: textSpacing === "wide" ? 0.75 : 0,
    fontFamily: readerFont === "serif" ? "serif" : readerFont === "accessible" ? "sans-serif" : undefined,
  };
}
