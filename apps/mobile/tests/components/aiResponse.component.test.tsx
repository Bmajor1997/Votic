import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { AIResponse } from "../../src/components/AIResponse";
import { KeyboardDictationButton } from "../../src/components/KeyboardDictationButton";
import { renderWithProviders } from "../renderWithProviders";

const start = jest.fn(async () => {});
const stop = jest.fn(async () => {});
jest.mock("expo-audio", () => ({
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioStream: jest.fn(() => ({
    isStreaming: false,
    stream: { isStreaming: false, start, stop },
  })),
}));

it("reveals answers word by word in reading order and lets the user show the full response", async () => {
  await renderWithProviders(<AIResponse text={"First word.\nNext line."} />);
  expect(screen.getByText("Generating response")).toBeTruthy();
  expect(screen.queryByText("First word.\nNext line.")).toBeNull();
  expect(screen.getByLabelText("First word.\nNext line.")).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(80));
  expect(screen.getByText("First word.\n")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Show full response" }));
  expect(screen.getByText("First word.\nNext line.")).toBeTruthy();
  expect(screen.queryByText("Generating response")).toBeNull();
});
it("finishes the reveal and clears the generating status", async () => {
  await renderWithProviders(<AIResponse text="One two three." />);
  await act(async () => jest.advanceTimersByTime(120));
  expect(screen.getByText("One two three.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show full response" })).toBeNull();
});
it("shows complete text immediately with reduced motion", async () => {
  await renderWithProviders(<AIResponse text="A complete answer." />, { reduceMotion: true });
  expect(screen.getByText("A complete answer.")).toBeTruthy();
  expect(screen.queryByText("Generating response")).toBeNull();
});
it("morphs the voice button into a compact waveform while dictation is active", async () => {
  const focus = jest.fn();
  await renderWithProviders(\n    <KeyboardDictationButton value="" onChangeText={jest.fn()} onFocus={focus} />,\n  );
  await fireEvent.press(screen.getByRole("button", { name: "Start voice input" }));
  expect(focus).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("voice-waveform")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Stop voice input" })).toBeTruthy();

  await fireEvent.press(screen.getByRole("button", { name: "Stop voice input" }));
  expect(focus).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId("voice-waveform")).toBeNull();
});
