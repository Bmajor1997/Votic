import { expect, it, jest } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { Animated } from "react-native";
import { AIResponse, AIThinking, AIStatus } from "../../src/components/AIResponse";
import { renderWithProviders } from "../renderWithProviders";

it("keeps the thinking label coherent and stops its shimmer on unmount", async () => {
  const start = jest.fn();
  const stop = jest.fn();
  const loop = jest.spyOn(Animated, "loop").mockReturnValue({ start, stop, reset: jest.fn() });
  const view = await renderWithProviders(<AIThinking />);
  expect(screen.getByLabelText("Thinking…").props.accessibilityLiveRegion).toBe("polite");
  expect(loop).toHaveBeenCalled();
  expect(start).toHaveBeenCalled();
  await view.unmount();
  expect(stop).toHaveBeenCalled();
});

it("uses static, accessible status text with Reduce Motion", async () => {
  const start = jest.fn();
  const stop = jest.fn();
  const loop = jest.spyOn(Animated, "loop").mockReturnValue({ start, stop, reset: jest.fn() });
  await renderWithProviders(<AIStatus compact label="Transcribing…" />, { reduceMotion: true });
  expect(screen.getByLabelText("Transcribing…").props.children).toBe("Transcribing");
  // If preferences loaded after mount, the initial loop must already be stopped.
  expect(stop.mock.calls.length).toBe(loop.mock.calls.length);
  start.mockClear();
  await act(async () => jest.advanceTimersByTime(5000));
  expect(start).not.toHaveBeenCalled();
});

it("stops reveal timers when an answer unmounts", async () => {
  const intervals = jest.spyOn(global, "setInterval");
  const clear = jest.spyOn(global, "clearInterval");
  const view = await renderWithProviders(<AIResponse text="One two three four." />);
  const index = intervals.mock.calls.findIndex((call) => call[1] === 40);
  expect(index).toBeGreaterThanOrEqual(0);
  const revealTimer = intervals.mock.results[index].value;
  await act(async () => jest.advanceTimersByTime(40));
  await view.unmount();
  expect(clear).toHaveBeenCalledWith(revealTimer);
});

it("does not animate answers marked for immediate display", async () => {
  await renderWithProviders(<AIResponse text="A complete fallback answer." animate={false} />);
  expect(screen.getByText("A complete fallback answer.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show full response" })).toBeNull();
});
