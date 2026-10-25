import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";

/** The V artwork's cropped aspect ratio (217 × 160): stroke and wings share one frame, so they overlay exactly. */
const V_ASPECT = 217 / 160;
const STROKE = require("../../assets/votic-v-stroke.png");
const WINGS = [
  require("../../assets/votic-v-wing-top.png"),
  require("../../assets/votic-v-wing-middle.png"),
  require("../../assets/votic-v-wing-bottom.png"),
];
const LETTERS = ["o", "t", "i", "c"] as const;

/**
 * Where each piece enters on the 0–1 entrance timeline: the V's left stroke, its top, middle and bottom wings, the
 * V settling, then o, t, i and c from left to right, then the whole wordmark settling. Pieces overlap slightly so
 * the sequence reads as one motion. Exported so tests and the Remotion study use the same choreography.
 */
export const WORDMARK_TIMELINE = {
  stroke: [0, 0.16],
  wings: [
    [0.12, 0.3],
    [0.22, 0.4],
    [0.32, 0.5],
  ],
  vSettle: [0.48, 0.58],
  letters: [
    [0.56, 0.68],
    [0.62, 0.74],
    [0.68, 0.8],
    [0.74, 0.86],
  ],
  finish: [0.88, 1],
} as const;

type Range = readonly [number, number];
const at = (range: Range, fraction: number) => range[0] + (range[1] - range[0]) * fraction;

/**
 * The Votic wordmark built from its real artwork: the V's stroke and three wings are separate layers in one frame,
 * and the letters are separate, so an entrance can assemble it piece by piece. With no `entrance` value it is the
 * finished logo. Sized from the type so the V sits on the letters' baseline at cap height.
 */
export function VoticWordmark({
  compact = false,
  entrance,
  pulse = false,
}: {
  compact?: boolean;
  /** 0 → 1 drives the assembly; omit for the finished logo. */
  entrance?: Animated.Value;
  /** The subtle one-time wing pulse other screens show on arrival. */
  pulse?: boolean;
}) {
  const { theme } = useVoticTheme();
  const fontSize = compact ? 22 : 30;
  const vHeight = Math.round(fontSize * 0.76);
  const vWidth = vHeight * V_ASPECT;
  const [finished] = useState(() => new Animated.Value(1));
  const progress = entrance ?? finished;
  const wingPulse = useWingPulse(pulse && !entrance);

  const stroke = WORDMARK_TIMELINE.stroke;
  const vSettle = WORDMARK_TIMELINE.vSettle;
  const finish = WORDMARK_TIMELINE.finish;
  // A touch of overshoot at the end of each piece reads as a light spring without a JavaScript frame loop.
  const settle = (range: Range, from: number, overshoot: number) =>
    progress.interpolate({
      inputRange: [range[0], at(range, 0.7), range[1]],
      outputRange: [from, overshoot, 0],
      extrapolate: "clamp",
    });
  const appear = (range: Range) =>
    progress.interpolate({
      inputRange: [range[0], at(range, 0.6)],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Votic logo"
      testID="votic-wordmark"
      style={[
        s.row,
        {
          height: Math.round(fontSize * 1.14),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [finish[0], at(finish, 0.45), finish[1]],
                outputRange: [1, 1.035, 1],
                extrapolate: "clamp",
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        testID="votic-wordmark-v"
        style={{
          width: vWidth,
          height: vHeight,
          // The letters' line box ends below their baseline; lift the V so its point sits on the baseline.
          marginBottom: Math.round(fontSize * 0.2),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [vSettle[0], at(vSettle, 0.5), vSettle[1]],
                outputRange: [1, 1.05, 1],
                extrapolate: "clamp",
              }),
            },
          ],
        }}
      >
        <Animated.Image
          testID="votic-wordmark-stroke"
          source={STROKE}
          resizeMode="contain"
          tintColor={theme.isDark ? "#FFF" : undefined}
          style={[
            s.layer,
            {
              opacity: appear(stroke),
              transform: [{ translateY: settle(stroke, vHeight * 0.25, -vHeight * 0.04) }],
            },
          ]}
        />
        {WINGS.map((source, index) => {
          const range = WORDMARK_TIMELINE.wings[index];
          return (
            <Animated.Image
              key={index}
              testID={`votic-wordmark-wing-${index + 1}`}
              source={source}
              resizeMode="contain"
              tintColor={theme.logoWing}
              style={[
                s.layer,
                {
                  opacity: appear(range),
                  // Each wing sweeps in from the right and joins the stroke.
                  transform: [
                    { translateX: settle(range, vWidth * 0.35, -vWidth * 0.03) },
                    { scale: wingPulse[index] },
                  ],
                },
              ]}
            />
          );
        })}
      </Animated.View>
      {LETTERS.map((letter, index) => {
        const range = WORDMARK_TIMELINE.letters[index];
        return (
          <Animated.Text
            key={letter}
            testID={`votic-wordmark-letter-${letter}`}
            maxFontSizeMultiplier={1}
            style={[
              s.letter,
              {
                color: theme.text,
                fontSize,
                lineHeight: Math.round(fontSize * 1.14),
                marginLeft: index === 0 ? Math.round(fontSize * 0.04) : -fontSize * 0.035,
                opacity: appear(range),
                transform: [{ translateX: settle(range, -fontSize * 0.3, fontSize * 0.03) }],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        );
      })}
    </Animated.View>
  );
}

/** One gentle pulse across the three wings, as the header logo has always done on arrival. */
function useWingPulse(active: boolean) {
  const [values] = useState(() => [new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]);
  useEffect(() => {
    values.forEach((value) => value.setValue(1));
    if (!active) return;
    const pulse = (value: Animated.Value) =>
      Animated.sequence([
        Animated.timing(value, { toValue: 1.12, duration: 110, useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]);
    const animation = Animated.sequence([
      Animated.delay(180),
      pulse(values[0]),
      Animated.delay(45),
      pulse(values[1]),
      Animated.delay(45),
      pulse(values[2]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, values]);
  return values;
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", alignSelf: "flex-start" },
  layer: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  letter: { fontWeight: "900", includeFontPadding: false },
});
