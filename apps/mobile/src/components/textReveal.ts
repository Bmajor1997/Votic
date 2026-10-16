export type TextRevealFrame = { text: string; visible: string; highlightStart: number; complete: boolean };

/** Animate only text already returned by the backend. Keep whitespace verbatim. */
export function reveal_completed_text(
  text: string,
  {
    startAt = 0,
    animate = true,
    onFrame,
    onComplete,
  }: {
    startAt?: number;
    animate?: boolean;
    onFrame: (frame: TextRevealFrame) => void;
    onComplete: () => void;
  },
): () => void {
  const boundaries = Array.from(
    text.slice(startAt).matchAll(/\S+\s*|\s+/gu),
    (match) => startAt + match.index + match[0].length,
  );
  let count = 0;
  let end = startAt;
  let timer: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;
  const step = Math.max(1, Math.ceil(boundaries.length / 60));
  function publish(complete: boolean, highlightStart: number) {
    onFrame({ text, visible: text.slice(0, end), highlightStart, complete });
  }
  if (!animate || !boundaries.length) {
    end = text.length;
    publish(true, text.length);
    onComplete();
  } else {
    publish(false, startAt);
    timer = setInterval(() => {
      if (cancelled) return;
      const previousEnd = end;
      count = Math.min(boundaries.length, count + step);
      end = boundaries[count - 1];
      const complete = count === boundaries.length;
      if (complete) clearInterval(timer);
      publish(complete, previousEnd);
      if (complete) onComplete();
    }, 40);
  }
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

/** AI answers can use Markdown list dashes and **bold**; show them as plain bullets and words. */
export function readable_ai_text(text: string) {
  return text.replace(/^([ \t]*)[-*][ \t]+/gm, "$1• ").replace(/\*\*(.+?)\*\*/g, "$1");
}

/** How many characters behind the writing edge are still glowing and settling into the text color. */
export const INK_TAIL = 32;
/** Words are laid down at a calm, reading-like pace... */
const CHARS_PER_SECOND = 40;
/** ...but a long answer speeds up so it never takes longer than this. */
const MAX_LAY_DOWN_MS = 15_000;
const LAY_DOWN_TICK_MS = 33;

/**
 * Lays an answer down from left to right at about 40 characters a second. `visible` is what has been written so
 * far; `highlightStart` is where the settled text ends. The last INK_TAIL characters before the writing edge
 * still glow (see `ink_segments`), and after the final character the glow finishes settling, so the whole
 * answer is plain text when `complete` is true.
 */
export function lay_down_text(
  text: string,
  { onFrame, onComplete }: { onFrame: (frame: TextRevealFrame) => void; onComplete: () => void },
): () => void {
  // Character boundaries by code point, so emoji and accented letters are never split.
  const ends = Array.from(text.matchAll(/[\s\S]/gu), (match) => match.index + match[0].length);
  const total = ends.length + INK_TAIL;
  const per_second = Math.max(CHARS_PER_SECOND, (total * 1000) / MAX_LAY_DOWN_MS);
  const per_tick = (per_second * LAY_DOWN_TICK_MS) / 1000;
  let written = 0;
  let cancelled = false;
  const at = (count: number) => (count < 1 ? 0 : ends[Math.min(Math.floor(count), ends.length) - 1]);
  const publish = () => {
    const complete = written >= total;
    onFrame({
      text,
      visible: text.slice(0, at(written)),
      highlightStart: complete ? text.length : at(written - INK_TAIL),
      complete,
    });
    return complete;
  };
  if (!ends.length) {
    onFrame({ text, visible: text, highlightStart: text.length, complete: true });
    onComplete();
    return () => {};
  }
  publish();
  const timer = setInterval(() => {
    if (cancelled) return;
    written = Math.min(total, written + per_tick);
    if (publish()) {
      clearInterval(timer);
      onComplete();
    }
  }, LAY_DOWN_TICK_MS);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

/**
 * The glowing part of a frame, in pieces from the settled text to the writing edge. `position` runs from 0
 * (about to settle into the text color) to 1 (the newest characters, glowing brightest and still fading in).
 */
export function ink_segments(frame: TextRevealFrame, pieces = 8): { text: string; position: number }[] {
  if (frame.complete) return [];
  const tail = Array.from(frame.visible.slice(frame.highlightStart));
  if (!tail.length) return [];
  const size = Math.max(1, Math.ceil(tail.length / pieces));
  const segments: { text: string; position: number }[] = [];
  for (let start = 0; start < tail.length; start += size) {
    const middle = start + Math.min(size, tail.length - start) / 2;
    // Measured against the full glow length, so the edge keeps its brightness even when little is written.
    const position = 1 - (tail.length - middle) / Math.max(INK_TAIL, tail.length);
    segments.push({
      text: tail.slice(start, start + size).join(""),
      position: Math.round(position * 100) / 100,
    });
  }
  return segments;
}
