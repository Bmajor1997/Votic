import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealCompletedText, type TextRevealFrame } from "./textReveal";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("completed text reveal", () => {
  it("preserves whitespace, paragraphs, punctuation, and links exactly", () => {
    const text = "  First, word.\n\nNext\tline: https://votic.app/help\n";
    const frames: TextRevealFrame[] = [];
    const complete = vi.fn();
    revealCompletedText(text, { onFrame: (frame) => frames.push(frame), onComplete: complete });
    vi.runAllTimers();
    expect(frames.at(-1)).toEqual(expect.objectContaining({ visible: text, complete: true }));
    expect(frames.every((frame) => text.startsWith(frame.visible))).toBe(true);
    expect(complete).toHaveBeenCalledOnce();
  });
  it("keeps a typed prefix visible and highlights only the new transcript", () => {
    const prefix = "My typed\nquestion: ";
    const frames: TextRevealFrame[] = [];
    revealCompletedText(prefix + "One two.", {
      startAt: prefix.length,
      onFrame: (frame) => frames.push(frame),
      onComplete: vi.fn(),
    });
    expect(frames[0].visible).toBe(prefix);
    vi.advanceTimersByTime(40);
    expect(frames[1]).toEqual(
      expect.objectContaining({ visible: prefix + "One ", highlightStart: prefix.length }),
    );
  });
  it("finishes long text in at most 2.4 seconds", () => {
    const complete = vi.fn();
    revealCompletedText("word ".repeat(10000), { onFrame: vi.fn(), onComplete: complete });
    vi.advanceTimersByTime(2400);
    expect(complete).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels without publishing more words or invoking completion", () => {
    const onFrame = vi.fn();
    const onComplete = vi.fn();
    const cancel = revealCompletedText("One two three.", { onFrame, onComplete });
    vi.advanceTimersByTime(40);
    cancel();
    const calls = onFrame.mock.calls.length;
    vi.runAllTimers();
    expect(onFrame).toHaveBeenCalledTimes(calls);
    expect(onComplete).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("publishes full text immediately without scheduling a timer when animation is disabled", () => {
    const onFrame = vi.fn();
    const onComplete = vi.fn();
    revealCompletedText("Full text.", { animate: false, onFrame, onComplete });
    expect(onFrame).toHaveBeenCalledWith({
      text: "Full text.",
      visible: "Full text.",
      highlightStart: 10,
      complete: true,
    });
    expect(onComplete).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
