import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INK_TAIL,
  ink_segments,
  lay_down_text,
  reveal_completed_text,
  type TextRevealFrame,
} from "./textReveal";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("completed text reveal", () => {
  it("preserves whitespace, paragraphs, punctuation, and links exactly", () => {
    const text = "  First, word.\n\nNext\tline: https://votic.app/help\n";
    const frames: TextRevealFrame[] = [];
    const complete = vi.fn();
    reveal_completed_text(text, { on_frame: (frame) => frames.push(frame), on_complete: complete });
    vi.runAllTimers();
    expect(frames.at(-1)).toEqual(expect.objectContaining({ visible: text, complete: true }));
    expect(frames.every((frame) => text.startsWith(frame.visible))).toBe(true);
    expect(complete).toHaveBeenCalledOnce();
  });
  it("keeps a typed prefix visible and highlights only the new transcript", () => {
    const prefix = "My typed\nquestion: ";
    const frames: TextRevealFrame[] = [];
    reveal_completed_text(prefix + "One two.", {
      startAt: prefix.length,
      on_frame: (frame) => frames.push(frame),
      on_complete: vi.fn(),
    });
    expect(frames[0].visible).toBe(prefix);
    vi.advanceTimersByTime(40);
    expect(frames[1]).toEqual(
      expect.objectContaining({ visible: prefix + "One ", highlightStart: prefix.length }),
    );
  });
  it("finishes long text in at most 2.4 seconds", () => {
    const complete = vi.fn();
    reveal_completed_text("word ".repeat(10000), { on_frame: vi.fn(), on_complete: complete });
    vi.advanceTimersByTime(2400);
    expect(complete).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels without publishing more words or invoking completion", () => {
    const on_frame = vi.fn();
    const on_complete = vi.fn();
    const cancel = reveal_completed_text("One two three.", { on_frame: on_frame, on_complete: on_complete });
    vi.advanceTimersByTime(40);
    cancel();
    const calls = on_frame.mock.calls.length;
    vi.runAllTimers();
    expect(on_frame).toHaveBeenCalledTimes(calls);
    expect(on_complete).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("publishes full text immediately without scheduling a timer when animation is disabled", () => {
    const on_frame = vi.fn();
    const on_complete = vi.fn();
    reveal_completed_text("Full text.", { animate: false, on_frame: on_frame, on_complete: on_complete });
    expect(on_frame).toHaveBeenCalledWith({
      text: "Full text.",
      visible: "Full text.",
      highlightStart: 10,
      complete: true,
    });
    expect(on_complete).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("laying an answer down", () => {
  it("advances left to right with a fading edge, ends fully inked, and keeps text intact", () => {
    const text = "Braille has six dots 👆 in two columns.\nEach letter is a pattern.";
    const frames: TextRevealFrame[] = [];
    const complete = vi.fn();
    lay_down_text(text, { on_frame: (frame) => frames.push(frame), on_complete: complete });
    vi.runAllTimers();
    for (const frame of frames) {
      expect(text.startsWith(frame.visible)).toBe(true);
      expect(frame.highlightStart).toBeLessThanOrEqual(frame.visible.length);
    }
    // The visible end and the inked edge only ever move forward.
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].visible.length).toBeGreaterThanOrEqual(frames[i - 1].visible.length);
      expect(frames[i].highlightStart).toBeGreaterThanOrEqual(frames[i - 1].highlightStart);
    }
    expect(frames.at(-1)).toEqual({ text, visible: text, highlightStart: text.length, complete: true });
    expect(complete).toHaveBeenCalledOnce();
  });
  it("lays words down at a reading pace: a short answer takes several seconds, a long one at most 15", () => {
    const short = vi.fn();
    lay_down_text("Braille was invented by Louis Braille, a Frenchman, in 1824. It uses six dots.", {
      on_frame: vi.fn(),
      on_complete: short,
    });
    vi.advanceTimersByTime(1500);
    expect(short).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2500);
    expect(short).toHaveBeenCalledOnce();
    const long = vi.fn();
    lay_down_text("word ".repeat(5000), { on_frame: vi.fn(), on_complete: long });
    vi.advanceTimersByTime(15_100);
    expect(long).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("glows brightest at the writing edge and never splits an emoji", () => {
    const frame = {
      text: "abcdefghij👆klmnop",
      visible: "abcdefghij👆klmnop",
      highlightStart: 4,
      complete: false,
    };
    const segments = ink_segments(frame);
    expect(segments.map((segment) => segment.text).join("")).toBe("efghij👆klmnop");
    for (let i = 1; i < segments.length; i++)
      expect(segments[i].position).toBeGreaterThan(segments[i - 1].position);
    expect(segments.at(-1)!.position).toBeGreaterThan(0.9);
    expect(ink_segments({ ...frame, complete: true })).toEqual([]);
    expect(INK_TAIL).toBeGreaterThan(0);
  });
});
