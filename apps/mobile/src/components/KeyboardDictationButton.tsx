import { Ionicons } from "@expo/vector-icons";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { transcribeVoiceQuestion } from "../api/voticApi";
import { useVoticTheme } from "../theme/ThemeProvider";
import { pcm16ToWav } from "../voice/pcmWav";

const BAR_HEIGHTS = [10, 18, 13, 21, 15];
const MAX_RECORDING_MS = 60_000;

export function KeyboardDictationButton({
  value,
  onChangeText,
  onFocus,
  disabled = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  disabled?: boolean;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [transcribing, setTranscribing] = useState(false);
  const chunks = useRef<ArrayBuffer[]>([]);
  const format = useRef({ sampleRate: 16_000, channels: 1 });
  const baseText = useRef("");
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useRef(BAR_HEIGHTS.map(() => new Animated.Value(0))).current;
  const streamResult = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer: AudioStreamBuffer) => {
      chunks.current.push(buffer.data.slice(0));
      format.current = { sampleRate: buffer.sampleRate, channels: buffer.channels };
    },
  });
  const listening = streamResult.isStreaming;

  useEffect(() => {
    if (!listening || reduceMotion) {
      pulse.forEach((item) => {
        item.stopAnimation();
        item.setValue(0);
      });
      return;
    }
    const animations = pulse.map((item, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 55),
          Animated.timing(item, {
            toValue: 1,
            duration: 260,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(item, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [listening, pulse, reduceMotion]);

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (streamResult.stream.isStreaming) void streamResult.stream.stop();
    },
    [streamResult.stream],
  );

  async function revealTranscript(transcript: string) {
    const prefix = baseText.current.trim();
    const words = transcript.split(/\s+/).filter(Boolean);
    if (reduceMotion) {
      onChangeText([prefix, transcript].filter(Boolean).join(" ").slice(0, 1000));
      return;
    }
    for (let i = 1; i <= words.length; i += 1) {
      onChangeText([prefix, words.slice(0, i).join(" ")].filter(Boolean).join(" ").slice(0, 1000));
      await new Promise((resolve) => setTimeout(resolve, 34));
    }
  }

  async function stopAndTranscribe() {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    await streamResult.stream.stop();
    if (!chunks.current.length) return;
    setTranscribing(true);
    try {
      const wav = pcm16ToWav(chunks.current, format.current.sampleRate, format.current.channels);
      const transcript = await transcribeVoiceQuestion(wav);
      await revealTranscript(transcript);
      onFocus();
    } catch (error) {
      Alert.alert(
        "Voice question",
        error instanceof Error ? error.message : "Votic could not transcribe that recording.",
      );
    } finally {
      chunks.current = [];
      setTranscribing(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }

  async function startRecording() {
    if (disabled || transcribing) return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone permission needed",
          "Allow microphone access to ask Votic a question with your voice. You can still type instead.",
        );
        return;
      }
      chunks.current = [];
      baseText.current = value;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await streamResult.stream.start();
      stopTimer.current = setTimeout(() => void stopAndTranscribe(), MAX_RECORDING_MS);
    } catch {
      Alert.alert("Voice question", "Votic could not start the microphone. Please try again.");
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        transcribing ? "Transcribing voice question" : listening ? "Stop voice input" : "Start voice input"
      }
      accessibilityHint={
        listening
          ? "Stops recording and adds your words to the question."
          : "Records a voice question. You can edit the transcript before sending."
      }
      accessibilityState={{ disabled: disabled || transcribing, selected: listening, busy: transcribing }}
      disabled={disabled || transcribing}
      onPress={() => void (listening ? stopAndTranscribe() : startRecording())}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: listening ? theme.sentenceHighlight : "transparent",
          opacity: disabled ? 0.4 : pressed ? 0.72 : 1,
        },
      ]}
    >
      {listening || transcribing ? (
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={s.waveform}
          testID="voice-waveform"
        >
          {BAR_HEIGHTS.map((height, index) => (
            <Animated.View
              key={height + "-" + index}
              style={[
                s.bar,
                {
                  backgroundColor: theme.accentText,
                  height,
                  opacity: transcribing ? 0.55 : 1,
                  transform: [
                    {
                      scaleY:
                        reduceMotion || transcribing
                          ? 0.72
                          : pulse[index].interpolate({ inputRange: [0, 1], outputRange: [0.48, 1] }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <Ionicons name="mic-outline" size={22} color={theme.accentText} />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: { width: 44, minHeight: 48, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  waveform: {
    width: 28,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  bar: { width: 3, borderRadius: 2 },
});
