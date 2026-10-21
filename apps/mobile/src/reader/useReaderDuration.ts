import { useMemo } from "react";
import { word_matches } from "./readerText";

/** Existing narration-time estimate, independent of its presentation and animations. */
export function useReaderDuration(text: string | undefined, rate: number, progress: number) {
  const totalWords = useMemo(() => word_matches(text || "").length, [text]);
  const totalSeconds = totalWords / Math.max(0.1, 2.6 * rate);
  return { totalSeconds, elapsedSeconds: totalSeconds * progress };
}
