import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  formatPlaybackRate,
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  normalizePlaybackRate,
  PLAYBACK_RATE_STEP,
} from "../playback/rates";
import { useVoticTheme } from "../theme/ThemeProvider";
import { controlSizes, radii, spacing, typography } from "../design/tokens";

const PRESETS = [0.75, 1, 1.5, 2] as const;
export function PlaybackSpeedControl({ rate, onChange }: { rate: number; onChange: (rate: number) => void }) {
  const { theme } = useVoticTheme();
  function step(delta: number) {
    onChange(normalizePlaybackRate(rate + delta));
  }
  return (
    <View>
      <View style={s.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease playback speed"
          disabled={rate <= MIN_PLAYBACK_RATE}
          onPress={() => step(-PLAYBACK_RATE_STEP)}
          style={({ pressed }) => [
            s.stepButton,
            {
              backgroundColor: theme.surfaceMuted,
              opacity: rate <= MIN_PLAYBACK_RATE ? 0.4 : pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text style={[s.stepSymbol, { color: theme.text }]}>−</Text>
        </Pressable>
        <View accessibilityLiveRegion="polite" style={s.value}>
          <Text style={[s.valueText, { color: theme.text }]}>{formatPlaybackRate(rate)}</Text>
          <Text style={[s.range, { color: theme.mutedText }]}>
            {formatPlaybackRate(MIN_PLAYBACK_RATE)}–{formatPlaybackRate(MAX_PLAYBACK_RATE)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase playback speed"
          disabled={rate >= MAX_PLAYBACK_RATE}
          onPress={() => step(PLAYBACK_RATE_STEP)}
          style={({ pressed }) => [
            s.stepButton,
            {
              backgroundColor: theme.surfaceMuted,
              opacity: rate >= MAX_PLAYBACK_RATE ? 0.4 : pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text style={[s.stepSymbol, { color: theme.text }]}>+</Text>
        </Pressable>
      </View>
      <Text style={[s.presetsLabel, { color: theme.mutedText }]}>Quick speeds</Text>
      <View style={s.presets}>
        {PRESETS.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: rate === value }}
            accessibilityLabel={formatPlaybackRate(value)}
            onPress={() => onChange(value)}
            style={({ pressed }) => [
              s.preset,
              {
                borderColor: rate === value ? theme.accent : theme.border,
                backgroundColor: rate === value ? theme.sentenceHighlight : theme.surface,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[typography.control, { color: rate === value ? theme.accent : theme.text }]}>
              {formatPlaybackRate(value)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    marginVertical: spacing.lg,
  },
  stepButton: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  stepSymbol: { fontSize: 26, fontWeight: "500", lineHeight: 30 },
  value: { flex: 1, alignItems: "center" },
  valueText: { fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"] },
  range: { fontSize: 12, marginTop: 2 },
  presetsLabel: { fontSize: 13, fontWeight: "600", marginBottom: spacing.sm },
  presets: { flexDirection: "row", gap: spacing.sm },
  preset: {
    flex: 1,
    minHeight: controlSizes.minimumTouch,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
