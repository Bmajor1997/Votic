import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from "expo-audio";
import type { AudioStreamOptions } from "expo-audio/build/AudioStream.types";
import { Alert, Animated, AppState, Pressable, StyleSheet, Text } from "react-native";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import Reader from "../../app/reader";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { AskVotic } from "../../app/assistant";
import {
  ask_votic,
  check_voice_question_availability,
  transcribe_voice_question,
} from "../../src/api/voticApi";
import { searchParams } from "../mocks/expoRouter";
import { VoiceRecordingArea, WAVEFORM_BARS } from "../../src/components/VoiceRecordingArea";
import { KeyboardDictationButton } from "../../src/components/KeyboardDictationButton";
import { AppProviders, render_with_providers, test_document } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock("../../src/api/voticApi", () => ({
  ask_votic: jest.fn(),
  check_voice_question_availability: jest.fn(),
  transcribe_voice_question: jest.fn(),
}));
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
  jest.mocked(transcribe_voice_question).mockReset();
  jest.mocked(ask_votic).mockReset();
  jest.mocked(check_voice_question_availability).mockResolvedValue(undefined);
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
    jest.mocked(transcribe_voice_question).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const view = await render_with_providers(<AskVotic />, { reduceMotion: true });
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
    await render_with_providers(
      <>
        <EnableReduceMotion />
        <AskVotic />
      </>,
    );
    jest.mocked(transcribe_voice_question).mockResolvedValueOnce("One two three four.");
    await start();
    await capture();
    await stop();
    await act(async () => jest.advanceTimersByTime(40));
    await fireEvent.press(screen.getByRole("button", { name: "Enable Reduce Motion" }));
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("One two three four.");
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
  });

  it("reveals a multiline transcript after Stop while locking edits and Send", async () => {
    await render_with_providers(<AskVotic />);
    const prefix = "Explain:\n";
    const transcript = "First, word.\n\nNext line.";
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), prefix);
    jest.mocked(transcribe_voice_question).mockResolvedValueOnce(transcript);
    await start();
    await capture();
    await stop();
    expect(screen.getByLabelText(prefix + transcript)).toBeTruthy();
    expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
    expect(screen.getByRole("button", { name: "Revealing voice transcript", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Send question", disabled: true }));
    expect(ask_votic).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(80));
    expect(screen.getByText(prefix + "First, word.\n\n")).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(120));
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe(prefix + transcript);
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
    expect(screen.getByRole("button", { name: "Send question", disabled: false })).toBeTruthy();
  });

  it("keeps the Reader's question box to one line while a transcript appears, then lets it grow", async () => {
    await render_with_providers(<OpenedReader />, { documents: [test_document("voice-doc", "Voice book")] });
    // Let the Reader finish opening (its first frame resets Ask Votic) before asking.
    await act(async () => jest.advanceTimersByTime(50));
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    await act(async () => jest.advanceTimersByTime(500));
    const transcript = "What does the author mean by saving, and how would I start doing that?";
    jest.mocked(transcribe_voice_question).mockResolvedValueOnce(transcript);
    await start();
    await capture();
    await stop();
    // While the words appear, the box stays one line and shows the newest words.
    const revealing = screen.getByLabelText(transcript);
    expect(revealing.props.numberOfLines).toBe(1);
    expect(revealing.props.ellipsizeMode).toBe("head");
    for (let step = 0; step < 10; step += 1) await act(async () => jest.advanceTimersByTime(100));
    // Once they're all there, it's the question box again, free to grow a line at a time.
    const input = screen.getByLabelText("Ask Votic a question");
    expect(input.props.value).toBe(transcript);
    expect(input.props.multiline).toBe(true);
    expect(StyleSheet.flatten(input.props.style).maxHeight).toBe(146);
  });

  it("cancels a transcript reveal when the microphone component unmounts", async () => {
    const onChangeText = jest.fn();
    const onRevealChange = jest.fn();
    const intervals = jest.spyOn(global, "setInterval");
    const clear = jest.spyOn(global, "clearInterval");
    jest.mocked(transcribe_voice_question).mockResolvedValueOnce("One two three four.");
    const view = await render_with_providers(
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
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Explain");
    let resolve!: (text: string) => void;
    jest.mocked(transcribe_voice_question).mockReturnValueOnce(
      new Promise<string>((done) => {
        resolve = done;
      }),
    );
    await start();
    expect(stream.start).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send question" })).toBeNull();
    expect(screen.getByTestId("voice-waveform", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText("Recording")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Stop voice input", selected: true }).props.accessibilityHint,
    ).toContain("transcribes");
    await capture();
    expect(transcribe_voice_question).not.toHaveBeenCalled();
    await stop();
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Transcribing")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Transcribing voice question", disabled: true, busy: true }),
    ).toBeTruthy();
    expect(transcribe_voice_question).toHaveBeenCalledWith(expect.any(ArrayBuffer), expect.any(AbortSignal));
    expect(ask_votic).not.toHaveBeenCalled();
    await act(async () => resolve("photosynthesis"));
    expect(screen.queryByTestId("voice-waveform", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("Explain photosynthesis");
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
    jest.mocked(ask_votic).mockResolvedValueOnce({
      answer: "Plants use light.",
      mode: "ai",
      sectionIndex: null,
      sectionTitle: null,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Send question", disabled: false }));
    expect(ask_votic).toHaveBeenCalledWith("Explain photosynthesis", undefined, [], "adaptive");
  });

  it("restores the typed question and shows a transcription error", async () => {
    const alert = jest.spyOn(Alert, "alert");
    jest
      .mocked(transcribe_voice_question)
      .mockRejectedValueOnce(new Error("Voice questions are temporarily unavailable."));
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "My typed question");
    await start();
    await capture();
    await stop();
    // Shown once, beside the question box, rather than in an alert as well.
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Voice questions are temporarily unavailable\./)).toHaveLength(1);
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("My typed question");
    expect(screen.getByRole("button", { name: "Retry voice transcription" })).toBeTruthy();
    // The recording can still be retried, so typing keeps the message that explains Retry.
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "My typed question, edited");
    expect(screen.getByText(/Retry transcription or discard the recording\./)).toBeTruthy();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
  });

  it.each([
    ["Ask Votic", "Voice questions are unavailable right now.", () => <AskVotic />],
    ["the Reader", "Voice questions are unavailable right now.", () => <OpenedReader />],
    // An older server's message that already includes the reminder still shows it once.
    [
      "Ask Votic",
      "Voice questions are unavailable right now. You can still type your question.",
      () => <AskVotic />,
    ],
  ])(
    "says 'You can still type your question' exactly once when voice is unavailable in %s",
    async (_screen, message, view) => {
      const alert = jest.spyOn(Alert, "alert");
      jest.mocked(check_voice_question_availability).mockRejectedValueOnce(new Error(message));
      await render_with_providers(view(), {
        documents: [test_document("voice-doc", "Voice book")],
        reduceMotion: true,
      });
      if (screen.queryByRole("button", { name: "Ask Votic about this page" }))
        await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
      await start();
      const shown = screen.getByText(/Voice questions are unavailable right now\./);
      expect(shown.props.children).toBe(
        "Voice questions are unavailable right now. You can still type your question.",
      );
      expect(shown.props.accessibilityRole).toBe("alert");
      expect(screen.getAllByText(/You can still type your question/)).toHaveLength(1);
      expect(alert).not.toHaveBeenCalled();
    },
  );

  it("gives a failed recording one next step: retry, without also repeating the typing reminder", async () => {
    jest
      .mocked(transcribe_voice_question)
      .mockRejectedValueOnce(
        new Error("Votic could not transcribe this voice question. Try typing it instead."),
      );
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    await stop();
    expect(
      screen.getByText(
        "Votic could not transcribe this voice question. Try typing it instead. Retry transcription or discard the recording.",
      ),
    ).toBeTruthy();
    expect(screen.queryAllByText(/You can still type your question/)).toHaveLength(0);
  });

  it.each([
    ["Ask Votic", () => <AskVotic />],
    ["the Reader", () => <OpenedReader />],
  ])("shows the voice sign-in message once in %s and clears it when typing", async (_screen, view) => {
    const alert = jest.spyOn(Alert, "alert");
    jest
      .mocked(check_voice_question_availability)
      .mockRejectedValueOnce(new Error("Sign in to use voice questions."));
    await render_with_providers(view(), {
      documents: [test_document("voice-doc", "Voice book")],
      reduceMotion: true,
    });
    if (screen.queryByRole("button", { name: "Ask Votic about this page" }))
      await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    await start();
    // The microphone is never requested for someone who can't use voice questions.
    expect(requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Sign in to use voice questions\./)).toHaveLength(1);
    // Typing is still allowed, and the voice message no longer describes what the person is doing.
    const input = screen.getByLabelText(/Ask Votic a question|Ask a question about this document/);
    expect(input.props.editable).not.toBe(false);
    await fireEvent.changeText(input, "What is this about?");
    expect(screen.queryByText(/Sign in to use voice questions/)).toBeNull();
    expect(screen.getByRole("button", { name: "Send question" }).props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it("explains an empty recording instead of silently returning", async () => {
    const alert = jest.spyOn(Alert, "alert");
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await stop();
    expect(transcribe_voice_question).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getAllByText(/No audio was captured/)).toHaveLength(1);
    expect(screen.getByLabelText("Ask Votic a question")).toBeTruthy();
  });

  it("handles microphone permission denial and leaves typing available", async () => {
    const alert = jest.spyOn(Alert, "alert");
    jest
      .mocked(requestRecordingPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as Awaited<
        ReturnType<typeof requestRecordingPermissionsAsync>
      >);
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    expect(stream.start).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      "Microphone permission needed",
      expect.stringContaining("type instead"),
    );
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
  });

  it("stops and transcribes at the existing recording limit", async () => {
    jest.mocked(transcribe_voice_question).mockResolvedValueOnce("A bounded recording");
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    await act(async () => jest.advanceTimersByTime(60000));
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(transcribe_voice_question).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("A bounded recording");
  });

  it("releases the microphone when leaving the screen", async () => {
    const view = await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await view.unmount();
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    await act(async () => jest.advanceTimersByTime(60000));
    expect(transcribe_voice_question).not.toHaveBeenCalled();
  });

  it("checks backend availability before opening the microphone and preserves typed text", async () => {
    jest
      .mocked(check_voice_question_availability)
      .mockRejectedValueOnce(new Error("Voice questions are not enabled on this Votic server yet."));
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Keep this question");
    await start();
    expect(stream.start).not.toHaveBeenCalled();
    expect(screen.getByText(/Voice questions are not enabled/)).toBeTruthy();
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("Keep this question");
  });

  it("retries the same recording without recapture and keeps edits made after failure", async () => {
    jest
      .mocked(transcribe_voice_question)
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce("the main point");
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    await stop();
    const firstAudio = jest.mocked(transcribe_voice_question).mock.calls[0][0];
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Explain");
    await fireEvent.press(screen.getByRole("button", { name: "Retry voice transcription" }));
    expect(stream.start).toHaveBeenCalledTimes(1);
    expect(jest.mocked(transcribe_voice_question).mock.calls[1][0]).toBe(firstAudio);
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("Explain the main point");
    expect(ask_votic).not.toHaveBeenCalled();
  });

  it("cancels a pending transcription, aborts its request, and ignores its late result", async () => {
    let finish!: (text: string) => void;
    jest.mocked(transcribe_voice_question).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "My draft");
    await start();
    await capture();
    await stop();
    const signal = jest.mocked(transcribe_voice_question).mock.calls[0][1];
    await fireEvent.press(screen.getByRole("button", { name: "Discard voice recording" }));
    expect(signal?.aborted).toBe(true);
    await act(async () => finish("Late text"));
    expect(screen.getByLabelText("Ask Votic a question").props.value).toBe("My draft");
    expect(screen.getByRole("button", { name: "Start voice input" })).toBeTruthy();
  });

  it("discards failed audio and allows a fresh recording", async () => {
    jest.mocked(transcribe_voice_question).mockRejectedValueOnce(new Error("Connection lost"));
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    await stop();
    await fireEvent.press(screen.getByRole("button", { name: "Discard voice recording" }));
    await start();
    expect(stream.start).toHaveBeenCalledTimes(2);
  });

  it("cancels capture in the background without uploading audio", async () => {
    const listener = jest.spyOn(AppState, "addEventListener");
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    const handler = (state: "active" | "background" | "inactive") => {
      for (const [event, callback] of listener.mock.calls) if (event === "change") callback(state);
    };
    await act(async () => handler("background"));
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(transcribe_voice_question).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
  });

  it("still records when Android pauses the app for the first microphone permission dialog", async () => {
    const listener = jest.spyOn(AppState, "addEventListener");
    let finish!: (permission: Awaited<ReturnType<typeof requestRecordingPermissionsAsync>>) => void;
    jest.mocked(requestRecordingPermissionsAsync).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    const handler = (state: "active" | "background" | "inactive") => {
      for (const [event, callback] of listener.mock.calls) if (event === "change") callback(state);
    };
    await act(async () => handler("background"));
    await act(async () => handler("active"));
    await act(async () =>
      finish({ granted: true } as Awaited<ReturnType<typeof requestRecordingPermissionsAsync>>),
    );
    expect(stream.start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Stop voice input" })).toBeTruthy();
  });

  it("does not open the microphone if the app stays in the background while starting", async () => {
    const listener = jest.spyOn(AppState, "addEventListener");
    let finish!: (permission: Awaited<ReturnType<typeof requestRecordingPermissionsAsync>>) => void;
    jest.mocked(requestRecordingPermissionsAsync).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    const handler = (state: "active" | "background" | "inactive") => {
      for (const [event, callback] of listener.mock.calls) if (event === "change") callback(state);
    };
    await act(async () => handler("background"));
    await act(async () =>
      finish({ granted: true } as Awaited<ReturnType<typeof requestRecordingPermissionsAsync>>),
    );
    expect(stream.start).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start voice input" })).toBeTruthy();
  });

  it("keeps recording when iOS briefly reports inactive", async () => {
    const listener = jest.spyOn(AppState, "addEventListener");
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    const handler = (state: "active" | "background" | "inactive") => {
      for (const [event, callback] of listener.mock.calls) if (event === "change") callback(state);
    };
    await act(async () => handler("inactive"));
    expect(stream.stop).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Stop voice input" })).toBeTruthy();
  });

  it("does not start capture after cancellation during permission request", async () => {
    let finish!: (permission: Awaited<ReturnType<typeof requestRecordingPermissionsAsync>>) => void;
    jest.mocked(requestRecordingPermissionsAsync).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await fireEvent.press(screen.getByRole("button", { name: "Discard voice recording" }));
    await act(async () =>
      finish({ granted: true } as Awaited<ReturnType<typeof requestRecordingPermissionsAsync>>),
    );
    expect(stream.start).not.toHaveBeenCalled();
  });

  it("tells a guest to sign in before asking for the microphone", async () => {
    jest
      .mocked(check_voice_question_availability)
      .mockRejectedValueOnce(new Error("Sign in to use voice questions."));
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    expect(requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/Sign in to use voice questions/)).toBeTruthy();
  });

  it("keeps duplicate Stop presses from making duplicate uploads", async () => {
    jest.mocked(transcribe_voice_question).mockImplementationOnce(() => new Promise(() => {}));
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    const button = screen.getByRole("button", { name: "Stop voice input" });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(transcribe_voice_question).toHaveBeenCalledTimes(1);
  });

  it("uses the hardware WAV format and bounds captured PCM to sixty seconds", async () => {
    jest.mocked(transcribe_voice_question).mockResolvedValueOnce("Short question");
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    const data = new ArrayBuffer(48000 * 2 * 61);
    await act(async () => options.onBuffer?.({ data, sampleRate: 48000, channels: 1, timestamp: 0.2 }));
    await stop();
    const wav = new DataView(jest.mocked(transcribe_voice_question).mock.calls[0][0]);
    expect(wav.getUint32(24, true)).toBe(48000);
    expect(wav.getUint32(40, true)).toBe(48000 * 2 * 60);
    expect(wav.byteLength).toBe(44 + 48000 * 2 * 60);
  });

  it("rejects changing audio formats instead of sending damaged WAV", async () => {
    const alert = jest.spyOn(Alert, "alert");
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    await start();
    await capture();
    await act(async () =>
      options.onBuffer?.({ data: new ArrayBuffer(16), sampleRate: 48000, channels: 1, timestamp: 0.4 }),
    );
    await stop();
    expect(transcribe_voice_question).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getAllByText(/unsupported audio format/)).toHaveLength(1);
    expect(screen.getByLabelText("Ask Votic a question").props.editable).toBe(true);
  });

  it("records inside the same one-line Reader bar instead of expanding it", async () => {
    await render_with_providers(<OpenedReader />, {
      documents: [test_document("voice-doc", "Voice book")],
      reduceMotion: true,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    const compactHeight = StyleSheet.flatten(screen.getByTestId("ask-votic-panel").props.style).height;
    await start();
    const composer = screen.getByTestId("voice-composer");
    expect(StyleSheet.flatten(composer.props.style).flexWrap).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId("ask-votic-panel").props.style).height).toBe(compactHeight);
    // Discard comes just before Stop, and the bar still measures large text.
    const buttons = screen.getAllByRole("button").map((button) => button.props.accessibilityLabel);
    expect(buttons.indexOf("Discard voice recording")).toBe(buttons.indexOf("Stop voice input") - 1);
    await fireEvent(composer, "layout", { nativeEvent: { layout: { height: 90, width: 280, x: 0, y: 0 } } });
    expect(
      StyleSheet.flatten(screen.getByTestId("ask-votic-panel").props.style).height,
    ).toBeGreaterThanOrEqual(112);
  });

  it("scrolls measured speech in from the right, decays it in silence, and shows the time", async () => {
    const view = await render_with_providers(<VoiceRecordingArea phase="recording" level={1} />);
    const heights = () =>
      screen
        .getByTestId("voice-waveform", { includeHiddenElements: true })
        .children.filter((bar) => typeof bar !== "string")
        .map((bar) => parseFloat(String(StyleSheet.flatten((bar as any).props.style).height)));
    // A level counts as current for 300 ms, so look while it's still fresh.
    await act(async () => jest.advanceTimersByTime(200));
    const speech = heights();
    expect(speech).toHaveLength(WAVEFORM_BARS);
    // The newest sound is at the right edge; older bars to the left are still at rest.
    expect(speech.at(-1)).toBeGreaterThan(50);
    expect(speech[0]).toBeLessThan(20);
    await act(async () => jest.advanceTimersByTime(2300));
    const silence = heights().slice(-10);
    expect(Math.max(...silence)).toBeLessThan(20);
    expect(new Set(silence).size).toBeGreaterThan(1);
    expect(screen.getByText("0:02")).toBeTruthy();
    const frozen = heights();
    await view.rerender(
      <AppProviders>
        <VoiceRecordingArea phase="transcribing" level={1} />
      </AppProviders>,
    );
    expect(screen.getByLabelText("Transcribing")).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(1000));
    expect(heights()).toEqual(frozen);
  });

  it("keeps the waveform steady with Reduce Motion while the time still counts", async () => {
    const timing = jest.spyOn(Animated, "timing");
    await render_with_providers(<VoiceRecordingArea phase="recording" level={0.9} />, { reduceMotion: true });
    expect(screen.getByLabelText("Recording")).toBeTruthy();
    const waveform = screen.getByTestId("voice-waveform", { includeHiddenElements: true });
    for (const bar of waveform.children) {
      if (typeof bar !== "string") expect(StyleSheet.flatten(bar.props.style).height).toBe("35%");
    }
    timing.mockClear();
    await act(async () => jest.advanceTimersByTime(3000));
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByText("0:03")).toBeTruthy();
  });
});

function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}

it("uses the recording composer inside Reader and releases it on Close", async () => {
  await render_with_providers(<OpenedReader />, {
    documents: [test_document("voice-doc", "Voice book")],
    reduceMotion: true,
  });
  await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
  const compactHeight = StyleSheet.flatten(screen.getByTestId("ask-votic-panel").props.style).height;
  await start();
  expect(StyleSheet.flatten(screen.getByTestId("ask-votic-panel").props.style).height).toBe(compactHeight);
  expect(screen.getByLabelText("Recording")).toBeTruthy();
  expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
  expect(screen.queryByRole("button", { name: "Send question" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
  expect(stream.stop).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
  expect(screen.getByLabelText("Ask Votic a question")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Start voice input" })).toBeTruthy();
});
