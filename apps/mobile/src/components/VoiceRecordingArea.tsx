import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { spacing, typography } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";
import { AIStatus } from "./AIResponse";
import type { VoiceInputPhase } from "./KeyboardDictationButton";

const BAR_COUNT = 24;
const BASELINE = 0.12;
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
  const [bars] = useState(() => Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.12)));
  const measurement = useRef({ level: 0, at: 0 });
  const envelope = useRef(0);
  useEffect(() => {
    measurement.current = { level, at: sampleTime ?? Date.now() };
  }, [level, sampleTime]);
  const recording = phase === "recording";
  const label = recording ? "Recording" : phase === "starting" ? "Starting microphone…" : "Transcribing…";

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(label);
  }, [label]);

  useEffect(() => {
    if (reduceMotion) {
      bars.forEach((bar) => bar.setValue(0.35));
      return;
    }
    let elapsed = 0;
    if (!recording) envelope.current = 0;
    let animations: Animated.CompositeAnimation[] = [];
    const tick = () => {
      // Decay even if the platform stops delivering samples; tiny baseline motion indicates
      // recording activity only. Speech heights always come from measured PCM energy.
      const fresh = Date.now() - measurement.current.at < 300;
      const target = recording && fresh ? measurement.current.level : 0;
      envelope.current += (target - envelope.current) * (target > envelope.current ? 0.7 : 0.3);
      elapsed += 0.1;
      animations.forEach((animation) => animation.stop());
      animations = bars.map((bar, index) => {
        const shape = 0.45 + 0.55 * Math.sin((index + 1) * 1.7) ** 2;
        const idle = recording ? 0.025 * (1 + Math.sin(elapsed * 2.5 + index * 0.4)) : 0;
        return Animated.timing(bar, {
          toValue: Math.min(1, BASELINE + idle + envelope.current * shape * 0.82),
          duration: 100,
          useNativeDriver: true,
          isInteraction: false,
        });
      });
      animations.forEach((animation) => animation.start());
    };
    tick();
    const timer = recording ? setInterval(tick, 100) : undefined;
    return () => {
      clearInterval(timer);
      animations.forEach((animation) => animation.stop());
    };
  }, [bars, recording, reduceMotion]);

  return (
    <View style={[s.surface, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      {phase === "transcribing" ? (
        <AIStatus compact label="Transcribing…" />
      ) : (
        <Text
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          style={[s.label, { color: theme.accentText }]}
        >
          {label}
        </Text>
      )}
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        testID="voice-waveform"
        style={s.waveform}
      >
        {bars.map((bar, index) => (
          <Animated.View
            key={index}
            style={[
              s.bar,
              { backgroundColor: theme.accentText, transform: [{ scaleY: reduceMotion ? 0.35 : bar }] },
            ]}
          />
        ))}
      </View>
      <Text style={[s.hint, { color: theme.mutedText }]}>
        {recording
          ? "Tap Stop when you’re finished"
          : phase === "starting"
            ? "Your words will appear after you stop"
            : "Turning your recording into words"}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  surface: {
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  label: { ...typography.eyebrow, fontWeight: "700" },
  hint: { fontSize: 12, lineHeight: 18 },
  waveform: { height: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bar: { flex: 1, maxWidth: 3, height: 28, borderRadius: 2 },
});
