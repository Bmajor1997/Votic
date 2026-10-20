import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Animated, Pressable } from "react-native";
import { AIResponse, AIThinking, AIStatus } from "../../src/components/AIResponse";
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

it("lands the status orb once per label, then keeps the word on screen", async () => {
  const loop = jest.spyOn(Animated, "loop");
  const timing = jest.spyOn(Animated, "timing");
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
    await render_with_providers(<Switcher />);
    const orb = screen.getByTestId("ai-status-orb", { includeHiddenElements: true });
    expect(orb.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(orb.props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByLabelText("Reading").props.accessibilityLiveRegion).toBe("polite");
    expect(timing).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(5000));
    // It never loops, so the word can't blink away while Votic works.
    expect(loop).not.toHaveBeenCalled();
    expect(timing).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Next status" }));
    expect(timing).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Thinking")).toBeTruthy();
  } finally {
    loop.mockRestore();
    timing.mockRestore();
  }
});

it("keeps screen-reader announcements and skips the orb with Less motion", async () => {
  await render_with_providers(<AIStatus label="Thinking…" />, { reduceMotion: true });
  expect(screen.getByLabelText("Thinking").props.accessibilityLiveRegion).toBe("polite");
  expect(screen.queryByTestId("ai-status-orb", { includeHiddenElements: true })).toBeNull();
});

it("leaves compact labels without the orb", async () => {
  await render_with_providers(<AIStatus compact label="Transcribing…" />);
  expect(screen.getByLabelText("Transcribing")).toBeTruthy();
  expect(screen.queryByTestId("ai-status-orb", { includeHiddenElements: true })).toBeNull();
});
