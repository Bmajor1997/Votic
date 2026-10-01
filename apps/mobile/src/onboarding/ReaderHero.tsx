import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii, spacing } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";

const SAMPLE = "Votic reads along with you, highlighting each word so it's easy to follow and remember.";
const WORDS = SAMPLE.split(" ");
const WORD_INTERVAL_MS = 420;

/** A small, real-looking slice of the Reader: the product explains itself instead of an illustration. */
export function ReaderHero() {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [animatedWord, setAnimatedWord] = useState(3);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(
      () => setAnimatedWord((current) => (current + 1) % WORDS.length),
      WORD_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [reduceMotion]);
  // With Reduce Motion the highlight holds still on one word.
  const word = reduceMotion ? 3 : animatedWord;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Example of Votic reading aloud and highlighting each word"
      style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={s.meta}>
        <View style={[s.play, { backgroundColor: theme.playButton }]}>
          <Ionicons name="pause" size={14} color={theme.playIcon} />
        </View>
        <Text style={[s.metaText, { color: theme.mutedText }]}>Listening · 1.0×</Text>
      </View>
      <Text style={[s.passage, { color: theme.text, backgroundColor: theme.sentenceHighlight }]}>
        {WORDS.map((value, index) => (
          <Text
            key={index}
            style={index === word ? { backgroundColor: theme.wordHighlight, fontWeight: "800" } : undefined}
          >
            {value}
            {index < WORDS.length - 1 ? " " : ""}
          </Text>
        ))}
      </Text>
      <View style={[s.track, { backgroundColor: theme.border }]}>
        <View
          style={[s.fill, { backgroundColor: theme.accent, width: `${((word + 1) / WORDS.length) * 100}%` }]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  play: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  metaText: { fontSize: 13, fontWeight: "700" },
  passage: { fontSize: 19, lineHeight: 31, borderRadius: 6 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%" },
});
