import { useEffect, useState, type ReactNode } from "react";
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
import { ai_shimmer_colors } from "./aiShimmerColors";
import {
  FadeIn,
  MeltingWord,
  remember_status_word,
  take_previous_status_word,
  WordMorph,
} from "./StatusWordMotion";
import { RevealingText } from "./RevealingText";
import { lay_down_text, readable_ai_text, type TextRevealFrame } from "./textReveal";
import { useVoticTheme } from "../theme/ThemeProvider";
import { ask_status } from "../ask/askStatus";

/**
 * Reveal completed answers in reading order; the complete answer remains available to assistive technology.
 * While the answer is being written, its status row comes first, in the same place and at the same height as
 * the AIThinking row it replaces, so the word ("Reading", "Thinking"…) turns into "Writing" where it already is
 * instead of dropping below. When the answer is done, "Writing" melts away and `header` (a source chip or title)
 * fades in where it was.
 */
export function AIResponse({
  text: raw,
  style,
  animate = true,
  header,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  animate?: boolean;
  header?: ReactNode;
}) {
  const text = readable_ai_text(raw);
  const { reduceMotion } = useAccessibilityPreferences();
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
    return lay_down_text(text, { on_frame: setFrame, on_complete: () => {} });
  }, [text, reduceMotion, animate, skipped]);
  const instant = reduceMotion || !animate || skipped;
  return (
    <View style={s.response}>
      <AnswerStatus
        complete={complete}
        skipped={instant}
        header={header}
        on_skip={() => setSkippedText(text)}
      />
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
/** The slot above the answer: "Writing" while it's written, the melt when it's done, then the source chip. */
function AnswerStatus({
  complete,
  skipped,
  header,
  on_skip,
}: {
  complete: boolean;
  /** No melt: Less motion, a saved answer, or Show all. */
  skipped: boolean;
  header?: ReactNode;
  on_skip: () => void;
}) {
  const { theme } = useVoticTheme();
  const [phase, setPhase] = useState<"writing" | "melting" | "done">(complete ? "done" : "writing");
  if (!complete && phase !== "writing") setPhase("writing");
  if (complete && phase === "writing") setPhase(skipped ? "done" : "melting");
  const [melted, setMelted] = useState(false);
  function finish_melt() {
    setMelted(true);
    setPhase("done");
  }
  // The chip takes the exact height of the row it replaces, so the answer below never moves.
  if (phase === "done")
    return melted ? <FadeIn style={header ? s.statusSlot : undefined}>{header}</FadeIn> : <>{header}</>;
  if (phase === "melting")
    return (
      <View style={[s.statusRow, s.meltRow]}>
        <View style={s.thinking}>
          <View style={s.meltStage}>
            <MeltingWord
              text="Writing"
              color={ai_shimmer_colors(theme.mode).blue}
              style={s.aiStatus}
              onDone={finish_melt}
            />
          </View>
        </View>
      </View>
    );
  return (
    <View style={s.statusRow}>
      <AIStatus label="Writing" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show full response"
        onPress={on_skip}
        style={s.skip}
      >
        <Text style={[s.status, { color: theme.accentText }]}>Show all</Text>
      </Pressable>
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
  // Same row shape as the answer's "Writing" row, so the word changes in place when the answer arrives.
  return (
    <View style={s.statusRow}>
      <View style={s.statusRowHeight}>
        <AIStatus label={summary ? "Summarizing" : ask_status(question, grounded)} />
      </View>
    </View>
  );
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
  const { blue } = ai_shimmer_colors(theme.mode);
  // The word grows out of the one before it, whether that was this row's last word or the row it replaced.
  const [morphFrom, setMorphFrom] = useState<string | null>(() =>
    compact ? null : take_previous_status_word(text),
  );
  const [shownText, setShownText] = useState(text);
  if (shownText !== text) {
    setShownText(text);
    if (!compact) setMorphFrom(shownText);
  }
  const morphing = Boolean(morphFrom) && !reduceMotion;
  useEffect(() => {
    if (compact) return;
    remember_status_word(text);
    return () => remember_status_word(text, Date.now());
  }, [text, compact]);
  const characters = Array.from(text);
  // Where each letter sits, measured from an invisible copy of the word; spaces get no bounce.
  const [layout, setLayout] = useState<{ text: string; spots: (Spot | undefined)[] }>({ text, spots: [] });
  const spots = layout.text === text ? layout.spots : [];
  const letters = bouncing_letters(text, spots) ?? [];
  const measured = bouncing_letters(text, spots) !== null;
  const ready = bounce && measured && letters.length > 0 && !morphing;
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

  const word =
    morphing && morphFrom ? (
      <WordMorph
        key={`${morphFrom}>${text}`}
        from={morphFrom}
        to={text}
        color={blue}
        style={s.aiStatus}
        onDone={() => setMorphFrom(null)}
      />
    ) : (
      <ShimmerText key={text} text={text} accessibilityLabel={text} style={s.aiStatus} />
    );
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
  // Matches the "Show all" button's height in the writing row, so the label sits at the same height in both.
  statusRowHeight: { minHeight: 48, justifyContent: "center" },
  // The answer's status slot: the Writing row (its Show all button is 48 tall), the melt, then the chip.
  statusSlot: { minHeight: 48, justifyContent: "center" },
  // A row (left to right), so only its height is set: the melting word stays at the left where Writing was.
  meltRow: { minHeight: 48 },
  status: { fontSize: 13 },
  aiStatus: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0.1, flexShrink: 1 },
  // Same place as the word inside bounceStage, so the melt starts exactly where "Writing" was.
  meltStage: { paddingTop: HEADROOM, paddingLeft: 16, paddingRight: 10 },
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
