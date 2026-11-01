import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Animated, Pressable } from "react-native";
import { AIResponse, AIThinking, AIStatus, bouncing_letters } from "../../src/components/AIResponse";
import { render_with_providers } from "../renderWithProviders";

it("sweeps a clearly lighter band of light across the thinking label and stops on unmount", async () => {
  const clear = jest.spyOn(global, "clearInterval");
  const view = await render_with_providers(<AIThinking />);
  const label = screen.getByLabelText("Thinking");
  expect(label.props.accessibilityLiveRegion).toBe("polite");
  expect(screen.queryByLabelText("Votic logo", { includeHiddenElements: true })).toBeNull();
  const colors = () =>
    (screen.getByLabelText("Thinking").props.children as { props: { style: { color: string } } }[]).map(
      (letter) => letter.props.style.color,
    );
  const initialColors = colors();
  // Resting letters are blue; the band's center is much lighter, so the sweep is easy to see.
  expect(initialColors.map((color) => color.toLowerCase())).toContain("#2563eb");
  const brightness = (color: string) =>
    [1, 3, 5].reduce((sum, start) => sum + parseInt(color.slice(start, start + 2), 16), 0);
  expect(Math.max(...initialColors.map(brightness))).toBeGreaterThan(brightness("#2563eb") + 150);
  expect(screen.queryByText("…")).toBeNull();
  await act(async () => jest.advanceTimersByTime(400));
  expect(colors()).not.toEqual(initialColors);
  await view.unmount();
  expect(clear).toHaveBeenCalled();
});

it("uses static, accessible status text with Reduce Motion", async () => {
  const intervals = jest.spyOn(global, "setInterval");
  await render_with_providers(<AIStatus compact label="Transcribing…" />, { reduceMotion: true });
  expect(screen.getByLabelText("Transcribing").props.children).toBe("Transcribing");
  intervals.mockClear();
  await act(async () => jest.advanceTimersByTime(5000));
  expect(intervals).not.toHaveBeenCalled();
});

it("stops reveal timers when an answer unmounts", async () => {
  const intervals = jest.spyOn(global, "setInterval");
  const clear = jest.spyOn(global, "clearInterval");
  const view = await render_with_providers(<AIResponse text="One two three four." />);
  const index = intervals.mock.calls.findIndex((call) => call[1] === 33);
  expect(index).toBeGreaterThanOrEqual(0);
  const revealTimer = intervals.mock.results[index].value;
  await act(async () => jest.advanceTimersByTime(24));
  await view.unmount();
  expect(clear).toHaveBeenCalledWith(revealTimer);
});

it("does not animate answers marked for immediate display", async () => {
  await render_with_providers(<AIResponse text="A complete fallback answer." animate={false} />);
  expect(screen.getByText("A complete fallback answer.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show full response" })).toBeNull();
});

/** Gives each invisible measuring letter a position, as a phone's layout pass would. */
async function lay_out_letters() {
  const letters = screen.getAllByTestId("ai-status-letter", { includeHiddenElements: true });
  for (const [index, letter] of letters.entries())
    await fireEvent(letter, "layout", {
      nativeEvent: { layout: { x: index * 9, y: 0, width: 9, height: 20 } },
    });
}

it("bounces the ball along the letters, keeps the word on screen, and restarts for a new label", async () => {
  const loop = jest.spyOn(Animated, "loop");
  try {
    function Switcher() {
      const [label, setLabel] = useState("Reading");
      return (
        <>
          <AIStatus label={label} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next status"
            onPress={() => setLabel("Thinking")}
          />
        </>
      );
    }
    const view = await render_with_providers(<Switcher />);
    // The ball waits until it knows where the letters are.
    expect(screen.queryByTestId("ai-status-orb", { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByTestId("ai-status-letter", { includeHiddenElements: true })).toHaveLength(7);
    await lay_out_letters();
    const ball = screen.getByTestId("ai-status-orb", { includeHiddenElements: true });
    expect(ball.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(ball.props.accessibilityElementsHidden).toBe(true);
    // The measuring copy is hidden from screen readers too, so the word is announced once.
    expect(screen.getAllByLabelText("Reading")).toHaveLength(1);
    expect(screen.getByLabelText("Reading").props.accessibilityLiveRegion).toBe("polite");
    expect(loop).toHaveBeenCalledTimes(1);
    const first = loop.mock.results[0].value as { stop: () => void };
    const stopFirst = jest.spyOn(first, "stop");
    await act(async () => jest.advanceTimersByTime(6000));
    expect(screen.getByLabelText("Reading")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Next status" }));
    expect(stopFirst).toHaveBeenCalled();
    expect(screen.getByLabelText("Thinking")).toBeTruthy();
    await lay_out_letters();
    expect(loop).toHaveBeenCalledTimes(2);
    const second = loop.mock.results[1].value as { stop: () => void };
    const stopSecond = jest.spyOn(second, "stop");
    await view.unmount();
    expect(stopSecond).toHaveBeenCalled();
  } finally {
    loop.mockRestore();
  }
});

it("only bounces on letters, not on the spaces between words, and waits for every letter", () => {
  const spot = (x: number) => ({ x, width: 9 });
  expect(bouncing_letters("Go on", [spot(0), spot(9), undefined, spot(27), spot(36)])).toEqual([
    spot(0),
    spot(9),
    spot(27),
    spot(36),
  ]);
  expect(bouncing_letters("Go on", [spot(0), spot(9), undefined, spot(27)])).toBeNull();
});

it("keeps screen-reader announcements and skips the orb with Less motion", async () => {
  const loop = jest.spyOn(Animated, "loop");
  await render_with_providers(<AIStatus label="Thinking…" />, { reduceMotion: true });
  expect(loop).not.toHaveBeenCalled();
  loop.mockRestore();
  expect(screen.getByLabelText("Thinking").props.accessibilityLiveRegion).toBe("polite");
  expect(screen.queryByTestId("ai-status-orb", { includeHiddenElements: true })).toBeNull();
});

it("leaves compact labels without the orb", async () => {
  await render_with_providers(<AIStatus compact label="Transcribing…" />);
  expect(screen.getByLabelText("Transcribing")).toBeTruthy();
  expect(screen.queryByTestId("ai-status-orb", { includeHiddenElements: true })).toBeNull();
});
