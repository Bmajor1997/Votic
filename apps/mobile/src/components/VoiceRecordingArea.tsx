import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { AIStatus } from "./AIResponse";
import type { VoiceInputPhase } from "./KeyboardDictationButton";

/** Enough bars to fill a wide composer; the oldest are clipped on narrow screens. */
export const WAVEFORM_BARS = 48;
const BASELINE = 0.12;
const TICK_MS = 100;
const STEADY = 0.35;

function clock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The recording state of the Ask Votic composer. It fits inside the same one-line bar as the question
 * box: a pulsing dot and the time so far, then a waveform that scrolls in from the right as you speak.
 * Heights come from the microphone's measured energy; when no sound arrives the bars settle to a
 * baseline with a slight shimmer, so it's clear Votic is still listening.
 */
export function VoiceRecordingArea({
  phase,
  level,
  sampleTime,
}: {
  phase: VoiceInputPhase;
  level: number;
  sampleTime?: number;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [history, setHistory] = useState<number[]>(() => Array(WAVEFORM_BARS).fill(BASELINE));
  const [elapsed, setElapsed] = useState(0);
  const measurement = useRef({ level: 0, at: 0 });
  const envelope = useRef(0);
  const startedAt = useRef<number | null>(null);
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    measurement.current = { level, at: sampleTime ?? Date.now() };
  }, [level, sampleTime]);
  const recording = phase === "recording";
  const label = recording ? "Recording" : phase === "starting" ? "Starting microphone…" : "Transcribing…";

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(label);
  }, [label]);

  useEffect(() => {
    if (!recording) {
      startedAt.current = null;
      envelope.current = 0;
      return;
    }
    // A new recording mounts this view afresh, so the time starts from 0:00.
    startedAt.current = Date.now();
    let ticks = 0;
    const tick = () => {
      if (startedAt.current !== null) setElapsed(Date.now() - startedAt.current);
      if (reduceMotion) return;
      // Decay even if the platform stops delivering samples; the small shimmer shows the mic is open.
      // Speech heights always come from measured PCM energy.
      const fresh = Date.now() - measurement.current.at < 300;
      const target = fresh ? measurement.current.level : 0;
      envelope.current += (target - envelope.current) * (target > envelope.current ? 0.7 : 0.3);
      ticks += 1;
      const shimmer = 0.03 * (1 + Math.sin(ticks * 0.9));
      setHistory((current) => [
        ...current.slice(1),
        Math.min(1, BASELINE + shimmer + envelope.current * 0.85),
      ]);
    };
    const timer = setInterval(tick, reduceMotion ? 1000 : TICK_MS);
    return () => clearInterval(timer);
  }, [recording, reduceMotion]);

  useEffect(() => {
    if (!recording || reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, recording, reduceMotion]);

  return (
    <View style={s.row}>
      {phase === "transcribing" ? (
        <AIStatus compact label="Transcribing…" />
      ) : (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={label}
          accessibilityLiveRegion="polite"
          style={s.status}
        >
          <Animated.View
            style={[s.dot, { backgroundColor: recording ? theme.linkText : theme.mutedText, opacity: pulse }]}
          />
          <Text style={[s.time, { color: theme.text }]}>{recording ? clock(elapsed) : "Starting…"}</Text>
        </View>
      )}
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        testID="voice-waveform"
        style={s.waveform}
      >
        {history.map((value, index) => (
          <View
            key={index}
            style={[
              s.bar,
              {
                height: `${Math.round((reduceMotion ? STEADY : value) * 100)}%`,
                backgroundColor: theme.linkText,
                // Older sound fades toward the left; everything dims while Votic transcribes.
                opacity: (recording ? 1 : 0.45) * (0.3 + (0.7 * (index + 1)) / WAVEFORM_BARS),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10 },
  status: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  time: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"], minWidth: 32 },
  waveform: {
    flex: 1,
    minWidth: 0,
    height: 24,
    overflow: "hidden",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 3,
  },
  bar: { width: 3, minHeight: 3, borderRadius: 2, flexShrink: 0 },
});
