import type { DocumentSourceRect } from "./DocumentTransitionProvider";

export type ReaderSourceTransform = {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
};

/**
 * The Reader opens from the tapped document card: at transition progress 0 it is scaled and moved onto
 * the card's rectangle, and at 1 it fills the window. Without a source card it simply fills the window.
 */
export function readerSourceTransform(
  source: DocumentSourceRect | null,
  window: { width: number; height: number },
): ReaderSourceTransform {
  if (!source) return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
  return {
    scaleX: Math.max(0.05, source.width / window.width),
    scaleY: Math.max(0.05, source.height / window.height),
    translateX: source.x + source.width / 2 - window.width / 2,
    translateY: source.y + source.height / 2 - window.height / 2,
  };
}
