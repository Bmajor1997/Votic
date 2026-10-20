import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
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

/**
 * A status label ("Reading", "Thinking", "Writing", "Summarizing"). Each time the label changes, a small orb drops in,
 * bounces twice, then stretches sideways and dissolves into the word, which appears where the orb melts. After that
 * the word stays on screen with its shimmer, so it never blinks away. The orb is decorative and hidden from screen
 * readers; ShimmerText announces the label and handles Less motion itself, and Less motion also skips the orb.
 * Compact labels (voice transcription) skip the orb to keep their row small. It doesn't touch answer generation.
 */
export function AIStatus({ label, compact = false }: { label: string; compact?: boolean }) {
  const text = label.replace(/(?:…|\.\.\.)$/, "");
  const { reduceMotion } = useAccessibilityPreferences();
  const { theme } = useVoticTheme();
  const [progress] = useState(() => new Animated.Value(1));
  const morph = !compact && !reduceMotion;

  useEffect(() => {
    progress.stopAnimation();
    if (!morph) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    // Linear time: the bounce and the morph are shaped by the keyframes below.
    const play = Animated.timing(progress, {
      toValue: 1,
      duration: MORPH_MS,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    });
    play.start();
    return () => play.stop();
  }, [text, morph, progress]);

  const word = <ShimmerText key={text} text={text} accessibilityLabel={text} style={s.aiStatus} />;
  if (!morph) return <View style={[s.thinking, compact && s.compact]}>{word}</View>;
  const at = (outputRange: number[]) => progress.interpolate({ inputRange: KEYFRAMES, outputRange });
  return (
    <View style={s.thinking}>
      <View style={s.morphStage}>
        <Animated.View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          testID="ai-status-orb"
          style={[
            s.morphOrb,
            {
              backgroundColor: theme.accent,
              shadowColor: theme.accent,
              opacity: at(ORB.opacity),
              transform: [
                { translateX: at(ORB.x) },
                { translateY: at(ORB.y) },
                { scaleX: at(ORB.scaleX) },
                { scaleY: at(ORB.scaleY) },
              ],
            },
          ]}
        />
        <Animated.View
          style={{
            opacity: at(WORD.opacity),
            transform: [{ translateX: at(WORD.x) }, { scale: at(WORD.scale) }],
          }}
        >
          {word}
        </Animated.View>
      </View>
    </View>
  );
}

/** The whole drop, bounce, and morph. */
const MORPH_MS = 1400;
/**
 * Keyframes, in order: start above, land (squash), first bounce up, land, small bounce, settle, start stretching,
 * melt into the word, done.
 */
const KEYFRAMES = [0, 0.06, 0.2, 0.32, 0.44, 0.52, 0.6, 0.66, 0.84, 1];
const ORB = {
  opacity: [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  y: [-16, -12, 2, -9, 1, -3, 0, 0, 0, 0],
  x: [0, 0, 0, 0, 0, 0, 0, 4, 22, 22],
  scaleX: [1, 1, 1.3, 0.9, 1.2, 0.95, 1, 1.4, 4, 4],
  scaleY: [1, 1, 0.7, 1.1, 0.8, 1.05, 1, 0.8, 0.3, 0.3],
};
const WORD = {
  opacity: [0, 0, 0, 0, 0, 0, 0, 0.2, 1, 1],
  x: [-8, -8, -8, -8, -8, -8, -8, -6, 0, 0],
  scale: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.94, 1.03, 1],
};

const s = StyleSheet.create({
  response: { gap: 4 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, flexShrink: 1 },
  compact: { minHeight: 20 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  status: { fontSize: 13 },
  aiStatus: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0.1, flexShrink: 1 },
  morphStage: { position: "relative", justifyContent: "center", minHeight: 24, paddingLeft: 4 },
  morphOrb: {
    position: "absolute",
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 5,
  },
  skip: { minHeight: 48, paddingHorizontal: 8, justifyContent: "center" },
});
