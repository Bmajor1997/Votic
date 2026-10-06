import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";

/** Reveal completed answers in reading order; the complete answer remains available to assistive technology. */
export function AIResponse({
  text,
  style,
  animate = true,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  animate?: boolean;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const { theme } = useVoticTheme();
  const words = useMemo(() => text.match(/\S+\s*|\s+/g) || [], [text]);
  const [reveal, setReveal] = useState({ text, count: 0 });
  const shown = reveal.text === text ? reveal.count : 0;
  const [skippedText, setSkippedText] = useState<string | null>(null);
  const skipped = skippedText === text;
  const complete = reduceMotion || !animate || skipped || shown >= words.length;
  useEffect(() => {
    if (reduceMotion || !animate || skipped) return;
    const step = Math.max(1, Math.ceil(words.length / 200));
    let count = 0;
    const timer = setInterval(() => {
      count = Math.min(words.length, count + step);
      setReveal({ text, count });
      if (count === words.length) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [text, words, reduceMotion, animate, skipped]);
  return (
    <View style={s.response}>
      {!complete ? (
        <View style={s.statusRow}>
          <AIStatus label="Generating response…" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show full response"
            onPress={() => setSkippedText(text)}
            style={s.skip}
          >
            <Text style={[s.status, { color: theme.accentText }]}>Show all</Text>
          </Pressable>
        </View>
      ) : null}
      <Text selectable accessibilityLabel={text} style={style}>
        {complete ? text : words.slice(0, shown).join("")}
      </Text>
    </View>
  );
}
export function AIThinking({ summary = false }: { summary?: boolean }) {
  return <AIStatus label={summary ? "Thinking about your summary…" : "Thinking…"} />;
}

function AIStatus({ label }: { label: string }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);
  return (
    <View accessibilityLiveRegion="polite" style={s.thinking}>
      <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={{ opacity }}>
        <Ionicons name="sparkles-outline" size={16} color={theme.aiStatusText} />
      </Animated.View>
      <View style={s.statusWords}>
        <Text accessibilityLabel={label} style={[s.aiStatus, { color: theme.aiStatusText }]}>
          {label.replace(/…$/, "")}
        </Text>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.dots}>
          {[0, 1, 2].map((index) => (
            <AIStatusDot key={index} index={index} color={theme.aiStatusText} reduceMotion={reduceMotion} />
          ))}
        </View>
      </View>
    </View>
  );
}
function AIStatusDot({
  index,
  color,
  reduceMotion,
}: {
  index: number;
  color: string;
  reduceMotion: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 140),
        Animated.timing(opacity, { toValue: 0.35, duration: 350, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.delay((2 - index) * 140),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [index, opacity, reduceMotion]);
  return <Animated.View style={[s.dot, { backgroundColor: color, opacity }]} />;
}
const s = StyleSheet.create({
  response: { gap: 4 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  status: { fontSize: 13 },
  aiStatus: { fontSize: 13, lineHeight: 20, fontWeight: "400", letterSpacing: 0.1 },
  statusWords: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dots: { flexDirection: "row", alignItems: "center", gap: 3 },
  dot: { width: 3, height: 3, borderRadius: 2 },
  skip: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
});
