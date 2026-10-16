import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { AIResponse } from "../../src/components/AIResponse";
import { edge_color, UNWRITTEN_INK } from "../../src/components/RevealingText";
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

// The answer's Text holds: the inked words, the glowing edge, then the rest of the word being written, invisible.
function parts(full: string) {
  const children = ([] as unknown[]).concat(screen.getByLabelText(full).props.children).filter(Boolean);
  const rest = children.at(-1) as { props?: { style?: { color?: string }; children?: string } };
  return {
    inked: typeof children[0] === "string" ? children[0] : "",
    hidden: rest?.props?.style?.color === UNWRITTEN_INK ? (rest.props.children ?? "") : "",
  };
}

it("writes answers from left to right, holding only the current word's place, and can show the full response", async () => {
  const answer = "First word.\nNext line of the answer.";
  await render_with_providers(<AIResponse text={answer} />);
  expect(screen.getByText("Writing")).toBeTruthy();
  // At first nothing is inked; only the first word's place is held, so it can't jump to another line mid-word.
  expect(parts(answer)).toEqual({ inked: "", hidden: "First" });
  await act(async () => jest.advanceTimersByTime(24 * 8));
  const midway = parts(answer);
  expect(answer.startsWith(midway.inked)).toBe(true);
  // The held part is never more than the rest of one word, so the answer grows line by line as it is written.
  expect(midway.hidden).not.toMatch(/\s/);
  expect(answer).toContain(midway.hidden);
  await fireEvent.press(screen.getByRole("button", { name: "Show full response" }));
  expect(screen.getByText(answer)).toBeTruthy();
  expect(screen.queryByText("Writing")).toBeNull();
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
  expect(screen.queryByText("Writing")).toBeNull();
});
it("offers an accessible native voice input control", async () => {
  await render_with_providers(
    <KeyboardDictationButton value="" onChangeText={jest.fn()} onFocus={jest.fn()} />,
  );
  expect(screen.getByRole("button", { name: "Start voice input" })).toBeTruthy();
});
it("forms the newest letters out of see-through light and settles older ones into the text color", () => {
  const text = "#202124",
    violet = "#7C3AED",
    light = "#D9C9F9";
  expect(edge_color(text, violet, light, 0, 0.9)).toBe(text);
  const newest = edge_color(text, violet, light, 1, 0);
  expect(newest).toMatch(/^#[0-9a-f]{8}$/);
  const alpha = parseInt(newest.slice(7), 16);
  // See-through while forming, but never alpha 0, which Android treats as "no color" and shows as plain text.
  expect(alpha).toBeGreaterThan(0);
  expect(alpha).toBeLessThan(128);
  expect(edge_color(text, violet, light, 0.5, 0.5)).not.toBe(edge_color(text, violet, light, 0.5, 0));
});
