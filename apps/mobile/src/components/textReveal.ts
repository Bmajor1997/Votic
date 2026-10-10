export type TextRevealFrame = { text: string; visible: string; highlightStart: number; complete: boolean };

/** Animate only text already returned by the backend. Keep whitespace verbatim. */
export function revealCompletedText(
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
