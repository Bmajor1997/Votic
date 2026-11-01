import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

/** One letter's part of a change between status words. */
export const MORPH_LETTER_MS = 240;
/** The gap between one letter starting and the next, so a change ripples across the word. */
export const MORPH_STAGGER_MS = 35;
/** How long the whole "Writing" melt takes, from the first letter softening to the last one gone. */
export const MELT_MS = 760;

/**
 * The last status word shown, kept briefly when its row closes. The "Thinking" row and the answer's "Writing" row
 * are separate views, so this is how "Writing" knows to grow out of "Thinking" rather than just appear.
 */
let lastWord: { text: string; at: number } | null = null;
const HANDOFF_MS = 1200;

/**
 * Called while a status word shows (with no time: it's still on screen) and when its row closes (with the time).
 * React renders the new row before the old one's clean-up runs, so a word still showing also counts.
 */
export function remember_status_word(text: string, closedAt: number = Number.POSITIVE_INFINITY) {
  lastWord = { text, at: closedAt };
}

/** Forgets the last word, e.g. between tests. */
export function forget_status_word() {
  lastWord = null;
}

/** The word that was just showing, if a different one closed a moment ago; it's used once. */
export function take_previous_status_word(next: string, now = Date.now()) {
  const previous = lastWord;
  lastWord = null;
  return previous &&
    previous.text !== next &&
    (previous.at === Number.POSITIVE_INFINITY || now - previous.at <= HANDOFF_MS)
    ? previous.text
    : null;
}

/**
 * The old word lifts away letter by letter while the new one rises into the same place, rippling left to right,
 * so "Reading" turns into "Thinking" or "Writing" instead of one vanishing and the next popping in.
 */
export function WordMorph({
  from,
  to,
  color,
  style,
  onDone,
}: {
  from: string;
  to: string;
  color: string;
  style?: StyleProp<TextStyle>;
  onDone: () => void;
}) {
  const oldLetters = Array.from(from);
  const newLetters = Array.from(to);
  const [values] = useState(() => ({
    out: oldLetters.map(() => new Animated.Value(0)),
    in: newLetters.map(() => new Animated.Value(0)),
  }));
  useEffect(() => {
    const step = (value: Animated.Value, delay: number, easing: (value: number) => number) =>
      Animated.timing(value, {
        toValue: 1,
        delay,
        duration: MORPH_LETTER_MS,
        easing,
        useNativeDriver: false,
      });
    const motion = Animated.parallel([
      ...values.out.map((value, index) => step(value, index * MORPH_STAGGER_MS, Easing.in(Easing.quad))),
      // The new word starts a beat later, so for a moment the two cross in the same place.
      ...values.in.map((value, index) =>
        step(value, 90 + index * MORPH_STAGGER_MS, Easing.out(Easing.cubic)),
      ),
    ]);
    motion.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => motion.stop();
    // Plays once per change; a new change remounts this with a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View accessible accessibilityLabel={to} accessibilityLiveRegion="polite" style={s.stage}>
      <View style={s.row}>
        {newLetters.map((letter, index) => (
          <Animated.Text
            key={`in-${index}`}
            style={[
              style,
              {
                color,
                opacity: values.in[index],
                transform: [
                  { translateY: values.in[index].interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) },
                ],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        ))}
      </View>
      <View style={[s.row, s.over]} pointerEvents="none">
        {oldLetters.map((letter, index) => (
          <Animated.Text
            key={`out-${index}`}
            style={[
              style,
              {
                color,
                opacity: values.out[index].interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [
                  { translateY: values.out[index].interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) },
                ],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        ))}
      </View>
    </View>
  );
}

/** Each letter's head start, uneven so the word melts in drips rather than as one block. */
const DRIP_DELAYS = [0, 140, 50, 210, 90, 170, 30, 120, 230, 70];

/**
 * When the answer is done, "Writing" melts: each letter softens, stretches downward and drips away, a little out
 * of step with its neighbors, then the word is gone.
 */
export function MeltingWord({
  text,
  color,
  style,
  onDone,
}: {
  text: string;
  color: string;
  style?: StyleProp<TextStyle>;
  onDone: () => void;
}) {
  const letters = Array.from(text);
  const [values] = useState(() => letters.map(() => new Animated.Value(0)));
  useEffect(() => {
    const longest = Math.max(...letters.map((_, index) => DRIP_DELAYS[index % DRIP_DELAYS.length]));
    const duration = MELT_MS - longest;
    const motion = Animated.parallel(
      values.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          delay: DRIP_DELAYS[index % DRIP_DELAYS.length],
          duration,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ),
    );
    motion.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => motion.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="ai-status-melting"
      style={s.row}
    >
      {letters.map((letter, index) => (
        <Animated.Text
          key={index}
          style={[
            style,
            {
              color,
              opacity: values[index].interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.7, 0] }),
              transform: [
                { translateY: values[index].interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) },
                {
                  scaleY: values[index].interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.35, 1.9] }),
                },
                { scaleX: values[index].interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) },
              ],
            },
          ]}
        >
          {letter}
        </Animated.Text>
      ))}
    </View>
  );
}

/** Fades in something that takes the melted word's place, like the answer's source chip. */
export function FadeIn({
  children,
  duration = 320,
  style,
}: {
  children: React.ReactNode;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const motion = Animated.timing(opacity, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    motion.start();
    return () => motion.stop();
  }, [opacity, duration]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  stage: { position: "relative" },
  row: { flexDirection: "row" },
  over: { position: "absolute", top: 0, left: 0 },
});
