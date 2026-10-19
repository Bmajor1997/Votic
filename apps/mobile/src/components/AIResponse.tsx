import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { ShimmerText } from "./ShimmerText";
import { RevealingText } from "./RevealingText";
import { lay_down_text, readable_ai_text, type TextRevealFrame } from "./textReveal";
import { useVoticTheme } from "../theme/ThemeProvider";
import { ask_status } from "../ask/askStatus";


/** Reveal completed answers in reading order; the complete answer remains available to assistive technology. */
export function AIResponse({
  text: raw,
  style,
  animate = true,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  animate?: boolean;
}) {
  const text = readable_ai_text(raw);
  const { reduceMotion } = useAccessibilityPreferences();
  const { theme } = useVoticTheme();
  const [frame, setFrame] = useState<TextRevealFrame>({
    text,
    visible: "",
    highlightStart: 0,
    complete: false,
  });
  const [skippedText, setSkippedText] = useState<string | null>(null);
  const skipped = skippedText === text;
  const complete = reduceMotion || !animate || skipped || (frame.text === text && frame.complete);
  useEffect(() => {
    if (reduceMotion || !animate || skipped) return;
    return lay_down_text(text, { onFrame: setFrame, onComplete: () => {} });
  }, [text, reduceMotion, animate, skipped]);
  return (
    <View style={s.response}>
      {!complete ? (
        <View style={s.statusRow}>
          <AIStatus label="Writing" />
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
      {reduceMotion || !animate || skipped ? (
        <Text selectable accessibilityLabel={text} style={style}>
          {text}
        </Text>
      ) : (
        <RevealingText
          frame={frame.text === text ? frame : { text, visible: "", highlightStart: 0, complete: false }}
          style={style}
        />
      )}
    </View>
  );
}
export function AIThinking({
  summary = false,
  question = "",
  grounded = false,
}: {
  summary?: boolean;
  question?: string;
  grounded?: boolean;
}) {
  return <AIStatus label={summary ? "Summarizing" : ask_status(question, grounded)} />;
}

/** A status-only animation. It does not touch answer generation or the answer's text reveal. */
export function AIStatus({ label, compact = false }: { label: string; compact?: boolean }) {
  const text = label.replace(/(?:…|\.\.\.)$/, "");
  const { reduceMotion } = useAccessibilityPreferences();
  const { theme } = useVoticTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (reduceMotion) return;
    // The orb lands, stretches into the leading glyph, and its light travels into the word.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 920, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1250),
        Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.delay(300),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [text, reduceMotion, progress]);

  const orbOpacity = progress.interpolate({ inputRange: [0, 0.38, 0.72, 1], outputRange: [1, 1, 0, 0] });
  const orbX = progress.interpolate({ inputRange: [0, 0.38, 0.72, 1], outputRange: [-10, 0, 2, 2] });
  const orbY = progress.interpolate({ inputRange: [0, 0.2, 0.38, 0.72, 1], outputRange: [-8, 3, -4, 0, 0] });
  const orbScaleX = progress.interpolate({ inputRange: [0, 0.38, 0.72, 1], outputRange: [1, 1, 0.28, 0.28] });
  const orbScaleY = progress.interpolate({ inputRange: [0, 0.38, 0.72, 1], outputRange: [1, 0.78, 1.5, 1.5] });
  const wordOpacity = progress.interpolate({ inputRange: [0, 0.4, 0.78, 1], outputRange: [0, 0, 1, 1] });
  const wordScale = progress.interpolate({ inputRange: [0, 0.4, 0.78, 1], outputRange: [0.96, 0.96, 1.02, 1] });

  return (
    <View style={[s.thinking, compact && s.compact]}>
      {reduceMotion ? (
        <Text accessibilityLabel={text} style={[s.aiStatus, { color: theme.aiStatusText }]}>{text}</Text>
      ) : (
        <View style={s.morphStage}>
          <Animated.View
            pointerEvents="none"
            style={[s.morphOrb, {
              backgroundColor: theme.accent,
              opacity: orbOpacity,
              transform: [{ translateX: orbX }, { translateY: orbY }, { scaleX: orbScaleX }, { scaleY: orbScaleY }],
            }]}
          />
          <Animated.View style={{ opacity: wordOpacity, transform: [{ scale: wordScale }] }}>
            <ShimmerText key={text} text={text} accessibilityLabel={text} style={s.aiStatus} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  response: { gap: 4 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, flexShrink: 1 },
  compact: { minHeight: 20 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  status: { fontSize: 13 },
  aiStatus: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0.1, flexShrink: 1 },
  morphStage: { position: "relative", justifyContent: "center", minHeight: 24, paddingLeft: 4 },
  morphOrb: { position: "absolute", left: 4, width: 16, height: 16, borderRadius: 8, shadowColor: "#7A72FF", shadowOpacity: 0.9, shadowRadius: 10, elevation: 5 },
  skip: { minHeight: 48, paddingHorizontal: 8, justifyContent: "center" },
});
