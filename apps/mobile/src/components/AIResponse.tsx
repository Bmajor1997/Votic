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
 * A status label ("Reading", "Thinking", "Writing", "Summarizing"). While it shows, a small orb keeps landing and
 * melting into the word. The word fades in once and then stays on screen, so it never blinks away; only the orb and
 * the shimmer move. The orb is decorative and hidden from screen readers; ShimmerText announces the label and handles
 * Less motion itself, and Less motion also stops the orb. Compact labels (voice transcription) skip the orb to keep
 * their row small. It doesn't touch answer generation or the answer reveal.
 */
export function AIStatus({ label, compact = false }: { label: string; compact?: boolean }) {
  const text = label.replace(/(?:…|\.\.\.)$/, "");
  const { reduceMotion } = useAccessibilityPreferences();
  const { theme } = useVoticTheme();
  const [progress] = useState(() => new Animated.Value(1));
  const [wordIn] = useState(() => new Animated.Value(1));
  const morph = !compact && !reduceMotion;

  useEffect(() => {
    progress.stopAnimation();
    wordIn.stopAnimation();
    if (!morph) {
      progress.setValue(1);
      wordIn.setValue(1);
      return;
    }
    progress.setValue(0);
    wordIn.setValue(0);
    const settings = { useNativeDriver: true, isInteraction: false };
    // The word arrives with the first orb, then stays put.
    const appear = Animated.timing(wordIn, {
      ...settings,
      toValue: 1,
      duration: ORB_MS,
      easing: Easing.out(Easing.cubic),
    });
    const orb = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          ...settings,
          toValue: 1,
          duration: ORB_MS,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.delay(ORB_REST_MS),
      ]),
    );
    appear.start();
    orb.start();
    return () => {
      appear.stop();
      orb.stop();
    };
  }, [text, morph, progress, wordIn]);

  const word = <ShimmerText key={text} text={text} accessibilityLabel={text} style={s.aiStatus} />;
  return (
    <View style={[s.thinking, compact && s.compact]}>
      {morph ? (
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
                opacity: progress.interpolate({
                  inputRange: [0, 0.1, 0.38, 0.72, 1],
                  outputRange: [0, 1, 1, 0, 0],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({ inputRange: [0, 0.38, 1], outputRange: [-10, 0, 2] }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 0.2, 0.38, 0.72, 1],
                      outputRange: [-8, 3, -4, 0, 0],
                    }),
                  },
                  {
                    scaleX: progress.interpolate({
                      inputRange: [0, 0.38, 0.72, 1],
                      outputRange: [1, 1, 0.28, 0.28],
                    }),
                  },
                  {
                    scaleY: progress.interpolate({
                      inputRange: [0, 0.38, 0.72, 1],
                      outputRange: [1, 0.78, 1.5, 1.5],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={{
              opacity: wordIn.interpolate({ inputRange: [0, 0.4, 0.78, 1], outputRange: [0, 0, 1, 1] }),
              transform: [
                {
                  scale: wordIn.interpolate({
                    inputRange: [0, 0.4, 0.78, 1],
                    outputRange: [0.96, 0.96, 1.02, 1],
                  }),
                },
              ],
            }}
          >
            {word}
          </Animated.View>
        </View>
      ) : (
        word
      )}
    </View>
  );
}

/** How long the orb takes to land and melt into the word, then how long it rests before the next one. */
const ORB_MS = 920;
const ORB_REST_MS = 1250;

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
