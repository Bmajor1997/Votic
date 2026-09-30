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
