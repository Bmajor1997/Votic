import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { spacing, typography } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";
import type { VoiceInputPhase } from "./KeyboardDictationButton";

const BAR_COUNT = 28;
export function VoiceRecordingArea({ phase, level }: { phase: VoiceInputPhase; level: number }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [bars] = useState(() => Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.12)));
  const history = useRef<number[]>(Array(BAR_COUNT).fill(0.12));
  const recording = phase === "recording";
  const label = recording ? "Recording" : phase === "starting" ? "Starting microphone…" : "Transcribing…";

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(label);
  }, [label]);

  useEffect(() => {
    history.current = [...history.current.slice(1), level];
    const animations = bars.map((bar, index) => {
      const height = recording ? history.current[index] : 0.12;
      if (reduceMotion) {
        bar.setValue(0.35);
        return null;
      }
      return Animated.timing(bar, {
        toValue: height,
        duration: 110,
        useNativeDriver: true,
        isInteraction: false,
      });
    });
    animations.forEach((animation) => animation?.start());
    return () => animations.forEach((animation) => animation?.stop());
  }, [bars, level, recording, reduceMotion]);

  return (
    <View style={[s.surface, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      <Text
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={[s.label, { color: theme.accentText }]}
      >
        {label}
      </Text>
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
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  label: { ...typography.eyebrow, fontWeight: "700" },
  hint: { fontSize: 12, lineHeight: 18 },
  waveform: { height: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bar: { width: 3, height: 28, borderRadius: 2 },
});
