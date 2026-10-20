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
 * A status label ("Reading", "Thinking", "Summarizing"…). While it shows, a small ball hops up from the ground beside
 * the word, bounces along the top of each letter in turn, drops back down, and starts again, like a sing-along ball.
 * The word itself never moves or fades. The ball is decorative and hidden from screen readers; ShimmerText announces
 * the label and handles Less motion itself, and Less motion also removes the ball. Compact labels (voice
 * transcription) skip the ball to keep their row small. It doesn't touch answer generation or the answer reveal.
 */
export function AIStatus({ label, compact = false }: { label: string; compact?: boolean }) {
  const text = label.replace(/(?:…|\.\.\.)$/, "");
  const { reduceMotion } = useAccessibilityPreferences();
  const { theme } = useVoticTheme();
  const bounce = !compact && !reduceMotion;
  const characters = Array.from(text);
  // Where each letter sits, measured from an invisible copy of the word; spaces get no bounce.
  const [layout, setLayout] = useState<{ text: string; spots: (Spot | undefined)[] }>({ text, spots: [] });
  const spots = layout.text === text ? layout.spots : [];
  const letters = bouncing_letters(text, spots) ?? [];
  const measured = bouncing_letters(text, spots) !== null;
  const ready = bounce && measured && letters.length > 0;
  const [step] = useState(() => new Animated.Value(-1));

  useEffect(() => {
    step.stopAnimation();
    step.setValue(-1);
    if (!ready) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(step, {
          toValue: letters.length,
          duration: (letters.length + 1) * HOP_MS,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(REST_MS),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // Restart only when the word or its measured layout changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, text, letters.map((spot) => `${spot.x},${spot.width}`).join("|"), step]);

  const word = <ShimmerText key={text} text={text} accessibilityLabel={text} style={s.aiStatus} />;
  if (!bounce) return <View style={[s.thinking, compact && s.compact]}>{word}</View>;

  function measure(index: number, x: number, width: number) {
    setLayout((current) => {
      const base = current.text === text ? current.spots : [];
      if (base[index]?.x === x && base[index]?.width === width) return current;
      const next = [...base];
      next[index] = { x, width };
      return { text, spots: next };
    });
  }

  return (
    <View style={s.thinking}>
      <View style={s.bounceStage}>
        {word}
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={s.measureRow}
        >
          {characters.map((character, index) => (
            <Text
              key={`${text}-${index}`}
              testID="ai-status-letter"
              onLayout={(event) => measure(index, event.nativeEvent.layout.x, event.nativeEvent.layout.width)}
              style={s.aiStatus}
            >
              {character}
            </Text>
          ))}
        </View>
        {ready ? <BouncingBall step={step} letters={letters} color={theme.accent} /> : null}
      </View>
    </View>
  );
}

type Spot = { x: number; width: number };

/**
 * The letters the ball lands on, in order, once every letter of the word has been measured; spaces are skipped.
 * Null until the measurements are in, so the ball never jumps to a wrong place first.
 */
export function bouncing_letters(text: string, spots: (Spot | undefined)[]): Spot[] | null {
  const characters = Array.from(text);
  if (characters.some((character, index) => character.trim() && !spots[index])) return null;
  return characters.flatMap((character, index) => {
    const spot = spots[index];
    return character.trim() && spot ? [spot] : [];
  });
}

/** One hop (ground to first letter, letter to letter, last letter to ground) takes this long. */
const HOP_MS = 260;
/** The ball rests on the ground this long before the next run. */
const REST_MS = 500;
const BALL = 8;
/** How high each hop rises above the letters. */
const ARC = 9;
/** Room above the word for the ball's arc. */
const HEADROOM = 16;
/** The ball's top on a letter (just touching the letter tops) and on the ground (beside the word's baseline). */
const ON_LETTER = HEADROOM - BALL + 2;
const ON_GROUND = HEADROOM + 15 - BALL;

/**
 * The ball, driven by `step`: -1 is the ground before the word, 0…n-1 are the letters, n is the ground after it.
 * Whole steps are landings (with a small squash); half steps are the tops of the hops.
 */
function BouncingBall({ step, letters, color }: { step: Animated.Value; letters: Spot[]; color: string }) {
  const n = letters.length;
  const centers = letters.map((spot) => spot.x + spot.width / 2 - BALL / 2);
  const last = letters[n - 1];
  const stops = [-1, ...letters.map((_, index) => index), n];
  const xs = [centers[0] - 14, ...centers, last.x + last.width + 6];
  const ys = [ON_GROUND, ...letters.map(() => ON_LETTER), ON_GROUND];
  const hopInput: number[] = [];
  const hopY: number[] = [];
  const squashY: number[] = [];
  const squashX: number[] = [];
  stops.forEach((stop, index) => {
    hopInput.push(stop);
    hopY.push(ys[index]);
    squashY.push(0.75);
    squashX.push(1.25);
    if (index < stops.length - 1) {
      hopInput.push(stop + 0.5);
      hopY.push(Math.min(ys[index], ys[index + 1]) - ARC);
      squashY.push(1.05);
      squashX.push(0.95);
    }
  });
  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="ai-status-orb"
      style={[
        s.ball,
        {
          backgroundColor: color,
          shadowColor: color,
          // Fades in on the ground at the start and out on the ground at the end, so the loop restarts unseen.
          opacity: step.interpolate({ inputRange: [-1, -0.75, n - 0.25, n], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: step.interpolate({ inputRange: stops, outputRange: xs }) },
            { translateY: step.interpolate({ inputRange: hopInput, outputRange: hopY }) },
            { scaleX: step.interpolate({ inputRange: hopInput, outputRange: squashX }) },
            { scaleY: step.interpolate({ inputRange: hopInput, outputRange: squashY }) },
          ],
        },
      ]}
    />
  );
}

const s = StyleSheet.create({
  response: { gap: 4 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, flexShrink: 1 },
  compact: { minHeight: 20 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  status: { fontSize: 13 },
  aiStatus: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0.1, flexShrink: 1 },
  bounceStage: { position: "relative", paddingTop: HEADROOM, paddingLeft: 16, paddingRight: 10 },
  measureRow: {
    position: "absolute",
    top: HEADROOM,
    left: 16,
    flexDirection: "row",
    opacity: 0,
  },
  ball: {
    position: "absolute",
    top: 0,
    left: 16,
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
  skip: { minHeight: 48, paddingHorizontal: 8, justifyContent: "center" },
});
