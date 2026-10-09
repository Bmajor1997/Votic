import { Ionicons } from "@expo/vector-icons";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Keyboard, Pressable, StyleSheet } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { transcribeVoiceQuestion } from "../api/voticApi";
import { useVoticTheme } from "../theme/ThemeProvider";
import { pcm16ToWav } from "../voice/pcmWav";

export type VoiceInputPhase = "idle" | "starting" | "recording" | "transcribing" | "reviewing";
const MAX_RECORDING_MS = 60_000;

export function KeyboardDictationButton({
  value,
  onChangeText,
  onFocus,
  onPhaseChange,
  onLevelChange,
  disabled = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onPhaseChange?: (phase: VoiceInputPhase) => void;
  onLevelChange?: (level: number) => void;
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
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamResult = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer: AudioStreamBuffer) => {
      if (!mounted.current || !["starting", "recording"].includes(phaseRef.current)) return;
      chunks.current.push(buffer.data.slice(0));
      format.current = { sampleRate: buffer.sampleRate, channels: buffer.channels };
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
      onLevelChange?.(Math.min(1, Math.max(0.12, Math.sqrt(sum / Math.max(1, count)) * 7)));
    },
  });
  const stopAction = useRef(stopAndTranscribe);
  const stream = useRef(streamResult.stream);
  useEffect(() => {
    stopAction.current = stopAndTranscribe;
    stream.current = streamResult.stream;
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

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && phaseRef.current === "recording") void stopAction.current();
    });
    return () => {
      mounted.current = false;
      clearTimer();
      subscription.remove();
      if (stream.current.isStreaming) stream.current.stop();
      if (phaseRef.current !== "idle") void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
    // The stream ref avoids stopping a recording when the hook reports status changes.
  }, []);

  async function revealTranscript(transcript: string) {
    if (!mounted.current) return;
    changePhase("reviewing");
    const prefix = baseText.current.trim();
    const words = transcript.split(/\s+/).filter(Boolean);
    if (reduceMotion) {
      onChangeText([prefix, transcript].filter(Boolean).join(" ").slice(0, 1000));
      return;
    }
    for (let i = 1; i <= words.length && mounted.current; i += 1) {
      onChangeText([prefix, words.slice(0, i).join(" ")].filter(Boolean).join(" ").slice(0, 1000));
      await new Promise((resolve) => setTimeout(resolve, 34));
    }
  }

  async function stopAndTranscribe() {
    if (phaseRef.current !== "recording") return;
    clearTimer();
    changePhase("transcribing");
    try {
      await stream.current.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!mounted.current) return;
      if (!chunks.current.length)
        throw new Error("No audio was captured. Please try again or type your question.");
      const wav = pcm16ToWav(chunks.current, format.current.sampleRate, format.current.channels);
      const transcript = await transcribeVoiceQuestion(wav);
      if (!transcript.trim())
        throw new Error("No words were detected. Please try again or type your question.");
      await revealTranscript(transcript);
    } catch (error) {
      if (mounted.current)
        Alert.alert(
          "Voice question",
          error instanceof Error ? error.message : "Votic could not transcribe that recording.",
        );
    } finally {
      chunks.current = [];
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      changePhase("idle");
      // Restore the question field before focusing it.
      if (mounted.current)
        requestAnimationFrame(() => {
          if (mounted.current) onFocus();
        });
    }
  }

  async function startRecording() {
    if (disabled || phaseRef.current !== "idle") return;
    changePhase("starting");
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted) {
        Alert.alert(
          "Microphone permission needed",
          "Allow microphone access to ask Votic a question with your voice. You can still type instead.",
        );
        changePhase("idle");
        return;
      }
      chunks.current = [];
      baseText.current = value;
      lastLevelAt.current = -1;
      onLevelChange?.(0.12);
      Keyboard.dismiss();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!mounted.current) {
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      await stream.current.start();
      if (!mounted.current) {
        stream.current.stop();
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      changePhase("recording");
      stopTimer.current = setTimeout(() => void stopAndTranscribe(), MAX_RECORDING_MS);
    } catch {
      if (stream.current.isStreaming) stream.current.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      changePhase("idle");
      if (mounted.current)
        Alert.alert("Voice question", "Votic could not start the microphone. Please try again.");
    }
  }

  const recording = phase === "recording";
  const busy = phase !== "idle" && !recording;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        recording
          ? "Stop voice input"
          : phase === "starting"
            ? "Starting microphone"
            : busy
              ? "Transcribing voice question"
              : "Start voice input"
      }
      accessibilityHint={
        recording
          ? "Stops recording and transcribes your words. Review them before sending."
          : "Records a voice question. Tap Stop when finished, then review and send."
      }
      accessibilityState={{ disabled: disabled || busy, selected: recording, busy }}
      disabled={disabled || busy}
      onPress={() => void (recording ? stopAndTranscribe() : startRecording())}
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
          name={recording ? "stop" : "mic-outline"}
          size={recording ? 20 : 22}
          color={recording ? "#FFF" : theme.accentText}
        />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: { width: 48, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
