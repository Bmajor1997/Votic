import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from "expo-audio";
import type { AudioStreamOptions } from "expo-audio/build/AudioStream.types";
import { Alert, Animated, Pressable, StyleSheet, Text } from "react-native";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import Reader from "../../app/reader";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { AskVotic } from "../../app/assistant";
import { askVotic, transcribeVoiceQuestion } from "../../src/api/voticApi";
import { searchParams } from "../mocks/expoRouter";
import { VoiceRecordingArea } from "../../src/components/VoiceRecordingArea";
import { KeyboardDictationButton } from "../../src/components/KeyboardDictationButton";
import { AppProviders, renderWithProviders, testDocument } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock("../../src/api/voticApi", () => ({ askVotic: jest.fn(), transcribeVoiceQuestion: jest.fn() }));
let options: AudioStreamOptions;
const stream = {
  isStreaming: false,
  start: jest.fn(async () => {
    stream.isStreaming = true;
  }),
  stop: jest.fn(() => {
    stream.isStreaming = false;
  }),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(transcribeVoiceQuestion).mockReset();
  jest.mocked(askVotic).mockReset();
  stream.isStreaming = false;
  stream.start.mockImplementation(async () => {
    stream.isStreaming = true;
  });
  jest
    .mocked(requestRecordingPermissionsAsync)
    .mockResolvedValue({ granted: true } as Awaited<ReturnType<typeof requestRecordingPermissionsAsync>>);
  jest.mocked(useAudioStream).mockImplementation((config) => {
    options = config!;
    return { stream, isStreaming: stream.isStreaming } as unknown as ReturnType<typeof useAudioStream>;
  });
});

async function start() {
  await fireEvent.press(screen.getByRole("button", { name: "Start voice input" }));
}
async function capture() {
  const data = new Int16Array([8000, -8000, 4000, -4000]).buffer;
  await act(async () => options.onBuffer?.({ data, sampleRate: 16000, channels: 1, timestamp: 0.2 }));
}
async function stop() {
  await fireEvent.press(screen.getByRole("button", { name: "Stop voice input" }));
}

function EnableReduceMotion() {
  const { setReduceMotion } = useAccessibilityPreferences();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Enable Reduce Motion"
      onPress={() => setReduceMotion(true)}
    >
      <Text>Reduce Motion</Text>
    </Pressable>
  );
}

describe("Ask Votic recording composer", () => {
  it("ignores a pending transcript after the Ask context changes", async () => {
    let finish!: (text: string) => void;
    jest.mocked(transcribeVoiceQuestion).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const view = await renderWithProviders(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    await stop();
    expect(screen.getByText("Transcribing")).toBeTruthy();
    searchParams.current = { notesDocumentId: "other-doc" };
    await view.rerender(
      <AppProviders>
        <AskVotic />
      </AppProviders>,
    );
    await act(async () => finish("Transcript from the previous context"));
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("");
    expect(screen.getByRole("button", { name: "Start voice input" })).toBeTruthy();
    expect(screen.queryByText("Transcribing")).toBeNull();
  });

  it("finishes an active transcript immediately when Reduce Motion is enabled", async () => {
    await renderWithProviders(
      <>
        <EnableReduceMotion />
        <AskVotic />
      </>,
    );
    jest.mocked(transcribeVoiceQuestion).mockResolvedValueOnce("One two three four.");
    await start();
    await capture();
    await stop();
    await act(async () => jest.advanceTimersByTime(40));
    await fireEvent.press(screen.getByRole("button", { name: "Enable Reduce Motion" }));
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("One two three four.");
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
  });

  it("reveals a multiline transcript after Stop while locking edits and Send", async () => {
    await renderWithProviders(<AskVotic />);
    const prefix = "Explain:\n";
    const transcript = "First, word.\n\nNext line.";
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), prefix);
    jest.mocked(transcribeVoiceQuestion).mockResolvedValueOnce(transcript);
    await start();
    await capture();
    await stop();
    expect(screen.getByLabelText(prefix + transcript)).toBeTruthy();
    expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
    expect(screen.getByRole("button", { name: "Revealing voice transcript", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Send question", disabled: true }));
    expect(askVotic).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(80));
    expect(screen.getByText(prefix + "First, word.\n\n")).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(120));
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe(prefix + transcript);
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
    expect(screen.getByRole("button", { name: "Send question", disabled: false })).toBeTruthy();
  });

  it("cancels a transcript reveal when the microphone component unmounts", async () => {
    const onChangeText = jest.fn();
    const onRevealChange = jest.fn();
    const intervals = jest.spyOn(global, "setInterval");
    const clear = jest.spyOn(global, "clearInterval");
    jest.mocked(transcribeVoiceQuestion).mockResolvedValueOnce("One two three four.");
    const view = await renderWithProviders(
      <KeyboardDictationButton
        value=""
        onChangeText={onChangeText}
        onFocus={jest.fn()}
        onRevealChange={onRevealChange}
      />,
    );
    await start();
    await capture();
    await stop();
    await act(async () => jest.advanceTimersByTime(40));
    const index = intervals.mock.calls.findIndex((call) => call[1] === 40);
    expect(index).toBeGreaterThanOrEqual(0);
    const revealTimer = intervals.mock.results[index].value;
    await view.unmount();
    const calls = onChangeText.mock.calls.length;
    const frames = onRevealChange.mock.calls.length;
    await act(async () => jest.advanceTimersByTime(1000));
    expect(onChangeText).toHaveBeenCalledTimes(calls);
    expect(onRevealChange).toHaveBeenCalledTimes(frames);
    expect(clear).toHaveBeenCalledWith(revealTimer);
  });

  it("replaces the question with a waveform and accessible Stop, then restores the transcript for review", async () => {
    await renderWithProviders(<AskVotic />, { reduceMotion: true });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Explain");
    let resolve!: (text: string) => void;
    jest.mocked(transcribeVoiceQuestion).mockReturnValueOnce(
      new Promise<string>((done) => {
        resolve = done;
      }),
    );
    await start();
    expect(stream.start).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send question" })).toBeNull();
    expect(screen.getByTestId("voice-waveform", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Recording")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Stop voice input", selected: true }).props.accessibilityHint,
    ).toContain("transcribes");
    await capture();
    expect(transcribeVoiceQuestion).not.toHaveBeenCalled();
    await stop();
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Transcribing…")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Transcribing voice question", disabled: true, busy: true }),
    ).toBeTruthy();
    expect(transcribeVoiceQuestion).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(askVotic).not.toHaveBeenCalled();
    await act(async () => resolve("photosynthesis"));
    expect(screen.queryByTestId("voice-waveform", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("Explain photosynthesis");
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
    jest.mocked(askVotic).mockResolvedValueOnce({
      answer: "Plants use light.",
      mode: "ai",
      sectionIndex: null,
      sectionTitle: null,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Send question", disabled: false }));
    expect(askVotic).toHaveBeenCalledWith("Explain photosynthesis", undefined, [], "adaptive");
  });

  it("restores the typed question and shows a transcription error", async () => {
    const alert = jest.spyOn(Alert, "alert");
    jest
      .mocked(transcribeVoiceQuestion)
      .mockRejectedValueOnce(new Error("Voice questions are temporarily unavailable."));
    await renderWithProviders(<AskVotic />, { reduceMotion: true });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "My typed question");
    await start();
    await capture();
    await stop();
    expect(alert).toHaveBeenCalledWith("Voice question", "Voice questions are temporarily unavailable.");
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("My typed question");
    expect(screen.getByRole("button", { name: "Start voice input" })).toBeTruthy();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
  });

  it("explains an empty recording instead of silently returning", async () => {
    const alert = jest.spyOn(Alert, "alert");
    await renderWithProviders(<AskVotic />, { reduceMotion: true });
    await start();
    await stop();
    expect(transcribeVoiceQuestion).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith("Voice question", expect.stringContaining("No audio was captured"));
    expect(screen.getByLabelText("Ask Votic a question")).toBeTruthy();
  });

  it("handles microphone permission denial and leaves typing available", async () => {
    const alert = jest.spyOn(Alert, "alert");
    jest
      .mocked(requestRecordingPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as Awaited<
        ReturnType<typeof requestRecordingPermissionsAsync>
      >);
    await renderWithProviders(<AskVotic />, { reduceMotion: true });
    await start();
    expect(stream.start).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      "Microphone permission needed",
      expect.stringContaining("type instead"),
    );
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
  });

  it("stops and transcribes at the existing recording limit", async () => {
    jest.mocked(transcribeVoiceQuestion).mockResolvedValueOnce("A bounded recording");
    await renderWithProviders(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    await act(async () => jest.advanceTimersByTime(60000));
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(transcribeVoiceQuestion).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("A bounded recording");
  });

  it("releases the microphone when leaving the screen", async () => {
    const view = await renderWithProviders(<AskVotic />, { reduceMotion: true });
    await start();
    await view.unmount();
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    await act(async () => jest.advanceTimersByTime(60000));
    expect(transcribeVoiceQuestion).not.toHaveBeenCalled();
  });

  it("keeps the waveform steady with Reduce Motion", async () => {
    const timing = jest.spyOn(Animated, "timing");
    await renderWithProviders(<VoiceRecordingArea phase="recording" level={0.9} />, { reduceMotion: true });
    expect(screen.getByText("Recording")).toBeTruthy();
    const waveform = screen.getByTestId("voice-waveform", { includeHiddenElements: true });
    for (const bar of waveform.children) {
      if (typeof bar !== "string") expect(StyleSheet.flatten(bar.props.style).transform[0].scaleY).toBe(0.35);
    }
    timing.mockClear();
    await act(async () => jest.advanceTimersByTime(1000));
    expect(timing).not.toHaveBeenCalled();
  });
});

function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}

it("uses the recording composer inside Reader and releases it on Close", async () => {
  await renderWithProviders(<OpenedReader />, {
    documents: [testDocument("voice-doc", "Voice book")],
    reduceMotion: true,
  });
  await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
  const compactHeight = StyleSheet.flatten(screen.getByTestId("ask-votic-panel").props.style).height;
  await start();
  expect(StyleSheet.flatten(screen.getByTestId("ask-votic-panel").props.style).height).toBeGreaterThan(
    compactHeight,
  );
  expect(screen.getByText("Recording")).toBeTruthy();
  expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
  expect(screen.queryByRole("button", { name: "Send question" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
  expect(stream.stop).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
  expect(screen.getByLabelText("Ask Votic a question")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Start voice input" })).toBeTruthy();
});
