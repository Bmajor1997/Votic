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

/** How many characters at the leading edge are still fading in while an answer is laid down. */
export const INK_TAIL = 24;
const LAY_DOWN_TICK_MS = 24;
const LAY_DOWN_MAX_TICKS = 100;

/**
 * Lays an answer down from left to right: the visible end advances a few characters at a time, and the
 * last INK_TAIL characters before it are still fading in (see `ink_segments`). `highlightStart` is where the
 * fully inked text ends; it trails the visible end by INK_TAIL and catches up after the last character, so the
 * whole answer is solid when `complete` is true. Long answers take about 2.4 seconds, short ones less.
 */
export function lay_down_text(
  text: string,
  { onFrame, onComplete }: { onFrame: (frame: TextRevealFrame) => void; onComplete: () => void },
): () => void {
  // Character boundaries by code point, so emoji and accented letters are never split.
  const ends = Array.from(text.matchAll(/[\s\S]/gu), (match) => match.index + match[0].length);
  const per_tick = Math.max(2, Math.ceil((ends.length + INK_TAIL) / LAY_DOWN_MAX_TICKS));
  let inked = 0;
  let cancelled = false;
  const at = (count: number) => (count <= 0 ? 0 : ends[Math.min(count, ends.length) - 1]);
  const publish = () => {
    const complete = inked >= ends.length + INK_TAIL;
    onFrame({
      text,
      visible: text.slice(0, at(inked)),
      highlightStart: complete ? text.length : at(inked - INK_TAIL),
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
    inked += per_tick;
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
 * The fading part of a frame, in a few pieces from most to least inked. Characters nearer the visible end are
 * fainter, so the words appear to be laid down from left to right.
 */
export function ink_segments(frame: TextRevealFrame, pieces = 6): { text: string; alpha: number }[] {
  if (frame.complete) return [];
  const tail = Array.from(frame.visible.slice(frame.highlightStart));
  if (!tail.length) return [];
  const size = Math.max(1, Math.ceil(tail.length / pieces));
  const segments: { text: string; alpha: number }[] = [];
  for (let start = 0; start < tail.length; start += size) {
    const middle = start + Math.min(size, tail.length - start) / 2;
    // From nearly solid at the inked edge to faint at the newest characters.
    const alpha = Math.max(0.08, 1 - middle / Math.max(INK_TAIL, tail.length));
    segments.push({ text: tail.slice(start, start + size).join(""), alpha: Math.round(alpha * 100) / 100 });
  }
  return segments;
}
