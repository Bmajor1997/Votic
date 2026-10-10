import { Ionicons } from "@expo/vector-icons";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Alert, AppState, Keyboard, Pressable, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { checkVoiceQuestionAvailability, transcribeVoiceQuestion } from "../api/voticApi";
import { useVoticTheme } from "../theme/ThemeProvider";
import { revealCompletedText, type TextRevealFrame } from "./textReveal";
import { pcm16ToWav } from "../voice/pcmWav";

export type VoiceInputPhase = "idle" | "starting" | "recording" | "transcribing" | "reviewing" | "error";
const MAX_RECORDING_MS = 60_000;

export function KeyboardDictationButton({
  value,
  onChangeText,
  onFocus,
  onPhaseChange,
  onLevelChange,
  onRevealChange,
  onErrorChange,
  active = true,
  disabled = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onPhaseChange?: (phase: VoiceInputPhase) => void;
  onLevelChange?: (level: number) => void;
  onRevealChange?: (frame: TextRevealFrame | null) => void;
  onErrorChange?: (message: string) => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [phase, setPhase] = useState<VoiceInputPhase>("idle");
  const phaseRef = useRef<VoiceInputPhase>("idle");
  const mounted = useRef(true);
  const chunks = useRef<ArrayBuffer[]>([]);
  const format = useRef({ sampleRate: 16_000, channels: 1 });
  const baseText = useRef("");
  const lastLevelAt = useRef(-1);
  const focusFrame = useRef<number | null>(null);
  const pendingTranscript = useRef<string | null>(null);
  const revealCancel = useRef<(() => void) | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const savedAudio = useRef<ArrayBuffer | null>(null);
  const session = useRef(0);
  const captureOpen = useRef(false);
  const capturedBytes = useRef(0);
  const captureError = useRef("");
  const startingOperation = useRef(false);
  const leftWhileStarting = useRef(false);
  const audioRelease = useRef<Promise<void>>(Promise.resolve());
  const streamResult = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer: AudioStreamBuffer) => {
      if (!mounted.current || !captureOpen.current) return;
      if (buffer.data.byteLength === 0) return;
      if (
        ![1, 2].includes(buffer.channels) ||
        buffer.sampleRate < 8000 ||
        buffer.sampleRate > 48000 ||
        buffer.data.byteLength % (buffer.channels * 2) ||
        (chunks.current.length &&
          (format.current.sampleRate !== buffer.sampleRate || format.current.channels !== buffer.channels))
      ) {
        captureError.current = "The microphone returned an unsupported audio format. Please record again.";
        return;
      }
      format.current = { sampleRate: buffer.sampleRate, channels: buffer.channels };
      // Bound by actual PCM duration as well as the timer, including late final buffers.
      const remaining = buffer.sampleRate * buffer.channels * 2 * 60 - capturedBytes.current;
      if (remaining <= 0) return;
      const chunk = buffer.data.slice(0, remaining);
      chunks.current.push(chunk);
      capturedBytes.current += chunk.byteLength;
      // Update the waveform at most ten times a second, using the captured PCM.
      if (buffer.timestamp - lastLevelAt.current < 0.1) return;
      lastLevelAt.current = buffer.timestamp;
      const samples = new DataView(buffer.data);
      let sum = 0;
      let count = 0;
      for (let offset = 0; offset + 1 < samples.byteLength; offset += 32) {
        const amplitude = samples.getInt16(offset, true) / 32768;
        sum += amplitude * amplitude;
        count += 1;
      }
      onLevelChange?.(Math.min(1, Math.sqrt(sum / Math.max(1, count)) * 7));
    },
  });
  const stream = useRef(streamResult.stream);
  const cancelAction = useRef(cancelRecording);
  useEffect(() => {
    stream.current = streamResult.stream;
    cancelAction.current = cancelRecording;
  });

  function changePhase(next: VoiceInputPhase) {
    phaseRef.current = next;
    if (!mounted.current) return;
    setPhase(next);
    onPhaseChange?.(next);
  }

  function clearTimer() {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
  }

  function releaseMicrophone() {
    try {
      if (stream.current.isStreaming) stream.current.stop();
    } catch {
      /* Native hook may already be released. */
    }
    captureOpen.current = false;
    audioRelease.current = setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    return audioRelease.current;
  }

  function cancelRecording() {
    if (phaseRef.current === "idle" && !startingOperation.current) return;
    session.current += 1;
    clearTimer();
    requestController.current?.abort();
    if (phaseRef.current === "reviewing" && mounted.current) onChangeText(baseText.current);
    revealCancel.current?.();
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = null;
    chunks.current = [];
    savedAudio.current = null;
    pendingTranscript.current = null;
    void releaseMicrophone();
    if (mounted.current) {
      onRevealChange?.(null);
      onErrorChange?.("");
      onLevelChange?.(0);
      changePhase("idle");
    }
  }

  useFocusEffect(useCallback(() => () => cancelAction.current(), []));
  useEffect(() => {
    if (!active) cancelAction.current();
  }, [active]);
  useEffect(() => {
    if (disabled && phaseRef.current === "error") cancelAction.current();
  }, [disabled]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        leftWhileStarting.current = false;
        return;
      }
      // iOS "inactive" covers Control Center, notifications, and system prompts; the app is still in front.
      if (state !== "background") return;
      // Android pauses the app while the microphone permission dialog is open. Decide after it closes.
      if (startingOperation.current) {
        leftWhileStarting.current = true;
        return;
      }
      cancelAction.current();
    });
    return () => {
      mounted.current = false;
      cancelAction.current();
      subscription.remove();
    };
    // The stream ref avoids stopping a recording when the hook reports status changes.
  }, []);

  useEffect(() => {
    if (!reduceMotion || phase !== "reviewing" || pendingTranscript.current === null) return;
    revealCancel.current?.();
    onChangeText(pendingTranscript.current);
    onRevealChange?.(null);
  }, [reduceMotion, phase, onChangeText, onRevealChange]);

  async function revealTranscript(transcript: string) {
    if (!mounted.current) return;
    const prefix = baseText.current;
    const separator = prefix && !/\s$/.test(prefix) ? " " : "";
    const text = prefix + separator + transcript;
    if (text.length > 1000)
      throw new Error(
        "Your typed text and recording exceed the 1,000-character question limit. Shorten the text before retrying, or discard and record a shorter question.",
      );
    if (reduceMotion) {
      onChangeText(text);
      return;
    }
    pendingTranscript.current = text;
    changePhase("reviewing");
    await new Promise<void>((resolve) => {
      const cancel = revealCompletedText(text, {
        startAt: Math.min(text.length, prefix.length + separator.length),
        onFrame: (frame) => {
          if (!mounted.current) return;
          onRevealChange?.(frame);
          onChangeText(frame.visible);
        },
        onComplete: resolve,
      });
      revealCancel.current = () => {
        cancel();
        resolve();
      };
    });
    revealCancel.current = null;
    pendingTranscript.current = null;
    if (mounted.current) onRevealChange?.(null);
  }

  async function stopAndTranscribe() {
    if (!["recording", "error"].includes(phaseRef.current)) return;
    const retry = phaseRef.current === "error";
    if (retry) baseText.current = value;
    if (retry && !savedAudio.current) return;
    const currentSession = session.current;
    const current = () => mounted.current && currentSession === session.current;
    clearTimer();
    changePhase("transcribing");
    onErrorChange?.("");
    try {
      if (!retry) {
        stream.current.stop();
        // Native stop is synchronous, but its queued final buffers may arrive on the next microtask.
        await Promise.resolve();
        captureOpen.current = false;
        await setAudioModeAsync({ allowsRecording: false });
        if (!current()) return;
        if (captureError.current) throw new Error(captureError.current);
        if (!chunks.current.length)
          throw new Error("No audio was captured. Please try again or type your question.");
        savedAudio.current = pcm16ToWav(chunks.current, format.current.sampleRate, format.current.channels);
        chunks.current = [];
      }
      requestController.current = new AbortController();
      const transcript = await transcribeVoiceQuestion(savedAudio.current!, requestController.current.signal);
      if (!current()) return;
      if (!transcript.trim())
        throw new Error("No words were detected. Please try again or type your question.");
      await revealTranscript(transcript);
      if (!current()) return;
      savedAudio.current = null;
      changePhase("idle");
    } catch (error) {
      if (current()) {
        const message = error instanceof Error ? error.message : "Votic could not transcribe that recording.";
        onErrorChange?.(message);
        changePhase(savedAudio.current ? "error" : "idle");
        Alert.alert("Voice question", message);
      }
    } finally {
      if (!current()) return;
      chunks.current = [];
      await releaseMicrophone();
      // Restore the question field before focusing it.
      if (current())
        focusFrame.current = requestAnimationFrame(() => {
          focusFrame.current = null;
          if (current()) onFocus();
        });
    }
  }

  async function startRecording() {
    if (disabled || !active || startingOperation.current || phaseRef.current !== "idle") return;
    startingOperation.current = true;
    leftWhileStarting.current = false;
    const currentSession = ++session.current;
    const current = () => mounted.current && currentSession === session.current;
    changePhase("starting");
    onErrorChange?.("");
    try {
      await audioRelease.current;
      if (!current()) return;
      const permission = await requestRecordingPermissionsAsync();
      if (!current()) return;
      if (!permission.granted) {
        Alert.alert(
          "Microphone permission needed",
          "Allow microphone access to ask Votic a question with your voice. You can still type instead.",
        );
        changePhase("idle");
        return;
      }
      requestController.current = new AbortController();
      await checkVoiceQuestionAvailability(requestController.current.signal);
      if (!current()) return;
      // The app went to the background while starting and has not come back: never open the mic there.
      if (leftWhileStarting.current) {
        cancelAction.current();
        return;
      }
      chunks.current = [];
      savedAudio.current = null;
      capturedBytes.current = 0;
      captureError.current = "";
      baseText.current = value;
      lastLevelAt.current = -1;
      onLevelChange?.(0);
      Keyboard.dismiss();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!current()) {
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      captureOpen.current = true;
      await stream.current.start();
      if (!current()) {
        stream.current.stop();
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      changePhase("recording");
      stopTimer.current = setTimeout(() => void stopAndTranscribe(), MAX_RECORDING_MS);
    } catch (error) {
      await releaseMicrophone();
      if (!current()) return;
      changePhase("idle");
      if (current()) {
        const message =
          error instanceof Error ? error.message : "Votic could not start the microphone. Please try again.";
        onErrorChange?.(message);
        Alert.alert("Voice question", message);
      }
    } finally {
      startingOperation.current = false;
    }
  }

  const recording = phase === "recording";
  const failed = phase === "error";
  const busy = !["idle", "error", "recording"].includes(phase);
  return (
    <View style={s.controls}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          failed
            ? "Retry voice transcription"
            : recording
              ? "Stop voice input"
              : phase === "starting"
                ? "Starting microphone"
                : phase === "reviewing"
                  ? "Revealing voice transcript"
                  : busy
                    ? "Transcribing voice question"
                    : "Start voice input"
        }
        accessibilityHint={
          failed
            ? "Sends the same recording for transcription again. Your typed text is kept."
            : recording
              ? "Stops recording and transcribes your words. Review them before sending."
              : "Records a voice question. Tap Stop when finished, then review and send."
        }
        accessibilityState={{ disabled: disabled || busy, selected: recording, busy }}
        disabled={disabled || busy}
        onPress={() => void (recording || failed ? stopAndTranscribe() : startRecording())}
        style={({ pressed }) => [
          s.button,
          {
            backgroundColor: recording ? theme.accent : "transparent",
            opacity: disabled ? 0.4 : pressed ? 0.72 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Ionicons
            name={failed ? "refresh" : recording ? "stop" : "mic-outline"}
            size={recording ? 20 : 22}
            color={recording ? "#FFF" : theme.accentText}
          />
        )}
      </Pressable>
      {phase !== "idle" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={failed ? "Discard voice recording" : "Cancel voice input"}
          onPress={cancelRecording}
          style={s.button}
        >
          <Ionicons name="close" size={22} color={theme.mutedText} />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  controls: { flexDirection: "row", flexShrink: 0, alignItems: "center" },
  button: { width: 48, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
