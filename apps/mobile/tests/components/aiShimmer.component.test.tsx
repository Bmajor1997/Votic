import { expect, it, jest } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { AIResponse, AIThinking, AIStatus } from "../../src/components/AIResponse";
import { render_with_providers } from "../renderWithProviders";

it("sweeps a violet band across the thinking label and stops on unmount", async () => {
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
  expect(initialColors).toContain("#7c3aed");
  expect(initialColors).toContain("#2563eb");
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
