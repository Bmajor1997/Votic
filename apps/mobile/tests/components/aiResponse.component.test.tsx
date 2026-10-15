import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { AIResponse } from "../../src/components/AIResponse";
import { KeyboardDictationButton } from "../../src/components/KeyboardDictationButton";
import { render_with_providers } from "../renderWithProviders";

jest.mock("expo-audio", () => ({
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioStream: jest.fn(() => ({
    isStreaming: false,
    stream: { isStreaming: false, start: jest.fn(async () => {}), stop: jest.fn(async () => {}) },
  })),
}));

// The answer's Text holds: the inked words, the fading edge, then the rest of the answer, invisible.
function parts(full: string) {
  const children = ([] as unknown[]).concat(screen.getByLabelText(full).props.children).filter(Boolean);
  const rest = children.at(-1) as { props?: { style?: { color?: string }; children?: string } };
  return {
    inked: typeof children[0] === "string" ? children[0] : "",
    hidden: rest?.props?.style?.color === "transparent" ? (rest.props.children ?? "") : "",
  };
}

it("lays answers down from left to right without moving text, and lets the user show the full response", async () => {
  const answer = "First word.\nNext line of the answer.";
  await render_with_providers(<AIResponse text={answer} />);
  expect(screen.getByText("Revealing response")).toBeTruthy();
  // At first nothing is inked, but the whole answer is already laid out (invisibly), so lines never jump.
  expect(parts(answer)).toEqual({ inked: "", hidden: answer });
  await act(async () => jest.advanceTimersByTime(24 * 8));
  const midway = parts(answer);
  expect(answer.startsWith(midway.inked)).toBe(true);
  expect(midway.hidden.length).toBeLessThan(answer.length);
  expect(answer.endsWith(midway.hidden)).toBe(true);
  await fireEvent.press(screen.getByRole("button", { name: "Show full response" }));
  expect(screen.getByText(answer)).toBeTruthy();
  expect(screen.queryByText("Revealing response")).toBeNull();
});
it("finishes laying down the answer, fully inked, and clears the generating status", async () => {
  await render_with_providers(<AIResponse text="One two three." />);
  await act(async () => jest.advanceTimersByTime(2600));
  expect(parts("One two three.")).toEqual({ inked: "One two three.", hidden: "" });
  expect(screen.queryByRole("button", { name: "Show full response" })).toBeNull();
});
it("shows complete text immediately with reduced motion", async () => {
  await render_with_providers(<AIResponse text="A complete answer." />, { reduceMotion: true });
  expect(screen.getByText("A complete answer.")).toBeTruthy();
  expect(screen.queryByText("Revealing response")).toBeNull();
});
it("offers an accessible native voice input control", async () => {
  await render_with_providers(
    <KeyboardDictationButton value="" onChangeText={jest.fn()} onFocus={jest.fn()} />,
  );
  expect(screen.getByRole("button", { name: "Start voice input" })).toBeTruthy();
});
