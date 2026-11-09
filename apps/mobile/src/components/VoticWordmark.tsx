import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";
import { HOME_ROBOT_TIMELINE } from "../motion/homeLogoTimeline";

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
 * V settling, then o, t, i and c from left to right, then the whole wordmark settling. Each piece finishes before the
 * next begins, so every wing and letter is seen arriving on its own. Exported so tests and the Remotion study use the same choreography.
 */
export const WORDMARK_TIMELINE = {
  stroke: [0, 0.12],
  wings: [
    [0.12, 0.24],
    [0.24, 0.36],
    [0.36, 0.48],
  ],
  vSettle: [0.48, 0.54],
  letters: [
    [0.54, 0.63],
    [0.63, 0.72],
    [0.72, 0.81],
    [0.81, 0.9],
  ],
  finish: [0.9, 1],
} as const;

export { HOME_ROBOT_TIMELINE } from "../motion/homeLogoTimeline";

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
  robotEntrance = false,
}: {
  compact?: boolean;
  /** 0 → 1 drives the assembly; omit for the finished logo. */
  entrance?: Animated.Value;
  /** The subtle one-time wing pulse other screens show on arrival. */
  pulse?: boolean;
  /** Home only: each letter arrives with its own robot. */
  robotEntrance?: boolean;
}) {
  const { theme } = useVoticTheme();
  const fontSize = compact ? 22 : 30;
  const vHeight = Math.round(fontSize * 0.76);
  const vWidth = vHeight * V_ASPECT;
  const [finished] = useState(() => new Animated.Value(1));
  const progress = entrance ?? finished;
  const wingPulse = useWingPulse(pulse && !entrance);

  const timeline = robotEntrance ? HOME_ROBOT_TIMELINE : WORDMARK_TIMELINE;
  const stroke = timeline.stroke;
  const vSettle = timeline.vSettle;
  const finish = timeline.finish;
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
              transform: robotEntrance
                ? [{ translateX: settle(stroke, -vWidth * 0.65, vWidth * 0.03) }]
                : [{ translateY: settle(stroke, vHeight * 0.25, -vHeight * 0.04) }],
            },
          ]}
        />
        {WINGS.map((source, index) => {
          const range = timeline.wings[index];
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
        const range = timeline.letters[index];
        const travel = progress.interpolate({
          inputRange: [range[0], at(range, 0.62), range[1]],
          outputRange: [fontSize * 2.4, 0, 0],
          extrapolate: "clamp",
        });
        const glyph = (
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
                transform: robotEntrance
                  ? [
                      { translateX: travel },
                      { rotate: progress.interpolate({
                        inputRange: [range[0], at(range, 0.62), at(range, 0.72), range[1]],
                        outputRange: ["-12deg", "-12deg", "0deg", "0deg"],
                        extrapolate: "clamp",
                      }) },
                      {
                        translateY: progress.interpolate({
                          inputRange: [range[0], at(range, 0.62), at(range, 0.72), range[1]],
                          outputRange: [-3, -3, 0, 0],
                          extrapolate: "clamp",
                        }),
                      },
                    ]
                  : [{ translateX: settle(range, -fontSize * 0.3, fontSize * 0.03) }],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        );
        if (!robotEntrance) return glyph;
        return (
          <Animated.View key={letter} style={s.carrierSlot} pointerEvents="none">
            <Animated.View
              testID={`votic-wordmark-robot-${letter}`}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                s.robot,
                {
                  opacity: progress.interpolate({
                    inputRange: [range[0], at(range, 0.12), at(range, 0.95), range[1]],
                    outputRange: [0, 1, 1, 0],
                    extrapolate: "clamp",
                  }),
                  transform: [
                    { translateX: progress.interpolate({
                      inputRange: [range[0], at(range, 0.62), at(range, 0.79), range[1]],
                      outputRange: [fontSize * 2.4, 0, 0, fontSize * 3],
                      extrapolate: "clamp",
                    }) },
                    { scaleX: progress.interpolate({
                      inputRange: [range[0], at(range, 0.73), at(range, 0.79), range[1]],
                      outputRange: [1, 1, -1, -1],
                      extrapolate: "clamp",
                    }) },
                  ],
                },
              ]}
            >
              {[0, 1].map((side) => (
                <Animated.View key={side} testID={`votic-robot-leg-${letter}-${side}`} style={[
                  s.leg, { left: side ? 14 : 12, transform: [{ translateX: progress.interpolate({
                    inputRange: [range[0], at(range, 0.16), at(range, 0.32), at(range, 0.48), at(range, 0.62), at(range, 0.79), at(range, 0.86), at(range, 0.93), range[1]],
                    outputRange: side ? [-3, 3, -3, 3, 0, 0, 3, -3, 0] : [3, -3, 3, -3, 0, 0, -3, 3, 0],
                    extrapolate: "clamp",
                  }) }, { translateY: progress.interpolate({
                    inputRange: [range[0], at(range, 0.16), at(range, 0.32), at(range, 0.48), at(range, 0.62), at(range, 0.79), at(range, 0.86), at(range, 0.93), range[1]],
                    outputRange: side ? [0, -4, 0, -4, 0, 0, -4, 0, 0] : [-4, 0, -4, 0, 0, 0, 0, -4, 0],
                    extrapolate: "clamp",
                  }) }, { rotate: progress.interpolate({
                    inputRange: [range[0], at(range, 0.16), at(range, 0.32), at(range, 0.48), at(range, 0.62), at(range, 0.79), at(range, 0.86), at(range, 0.93), range[1]],
                    outputRange: side ? ["-20deg", "20deg", "-20deg", "20deg", "0deg", "0deg", "20deg", "-20deg", "0deg"] : ["20deg", "-20deg", "20deg", "-20deg", "0deg", "0deg", "-20deg", "20deg", "0deg"],
                    extrapolate: "clamp",
                  }) }] },
                ]}>
                  <Animated.View style={s.foot} />
                </Animated.View>
              ))}
              <Animated.View testID={`votic-robot-lean-${letter}`} style={{ width: 28, height: 28, transform: [{ rotate: progress.interpolate({
                inputRange: [range[0], at(range, 0.18), at(range, 0.36), at(range, 0.54), at(range, 0.62), at(range, 0.72), range[1]],
                outputRange: ["12deg", "15deg", "12deg", "15deg", "10deg", "0deg", "0deg"],
                extrapolate: "clamp",
              }) }] }}>
              <Animated.View testID={`votic-robot-profile-${letter}`} style={s.profileBody} />
              <Animated.View style={s.profileHead}>
                <Animated.View style={s.profileFace}>
                  <Animated.View style={s.profileEye} />
                </Animated.View>
                <Animated.View style={s.profileEar} />
              </Animated.View>
              <Animated.View style={s.carryArm} />
              </Animated.View>
            </Animated.View>
            {glyph}
            <Animated.View testID={`votic-robot-grip-${letter}`} style={[s.grip, {
              opacity: progress.interpolate({ inputRange: [range[0], at(range, 0.12), at(range, 0.62), at(range, 0.72), range[1]], outputRange: [0, 1, 1, 0, 0], extrapolate: "clamp" }),
              transform: [
                { translateX: travel },
                { rotate: progress.interpolate({ inputRange: [range[0], at(range, 0.62), at(range, 0.72), range[1]], outputRange: ["-12deg", "-12deg", "0deg", "0deg"], extrapolate: "clamp" }) },
                { translateY: progress.interpolate({ inputRange: [range[0], at(range, 0.62), at(range, 0.72), range[1]], outputRange: [-3, -3, 0, 0], extrapolate: "clamp" }) },
              ],
            }]}>
              <Animated.View style={s.forearm} />
              <Animated.View style={s.forearm} />
            </Animated.View>
          </Animated.View>
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
  carrierSlot: { position: "relative" },
  // Facing left, behind the letter; the rounded white shell and blue visor echo the AI Usage robot.
  robot: { position: "absolute", width: 28, height: 28, top: -5, left: 13 },
  profileHead: { position: "absolute", top: 0, left: 6, width: 19, height: 16, borderRadius: 8, backgroundColor: "#edf5ff", borderWidth: 1, borderColor: "#9bb6cf" },
  profileFace: { position: "absolute", top: 4, left: -1, width: 11, height: 8, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: 5, borderBottomRightRadius: 5, backgroundColor: "#163b70" },
  profileEye: { position: "absolute", top: 2, left: 3, width: 3, height: 3, borderRadius: 2, backgroundColor: "#fff" },
  profileEar: { position: "absolute", top: 4, right: -3, width: 5, height: 7, borderRadius: 3, backgroundColor: "#1689ec" },
  profileBody: { position: "absolute", top: 14, left: 10, width: 13, height: 10, borderRadius: 5, backgroundColor: "#dbeaff", borderWidth: 1, borderColor: "#9bb6cf" },
  leg: { position: "absolute", top: 20, width: 5, height: 9, borderRadius: 3, backgroundColor: "#dbe8f5", borderWidth: 1, borderColor: "#8ba9c8" },
  foot: { position: "absolute", left: -3, bottom: -1, width: 8, height: 4, borderRadius: 2, backgroundColor: "#9bb9d7" },
  carryArm: { position: "absolute", top: 16, left: 2, width: 13, height: 5, borderRadius: 3, backgroundColor: "#edf5ff", borderWidth: 1, borderColor: "#9bb6cf", transform: [{ rotate: "-18deg" }] },
  // The grip shares the letter's position and tilt, then opens as it is placed.
  grip: { position: "absolute", left: 0, right: -4, bottom: 3, height: 7, justifyContent: "space-between" },
  forearm: { width: "100%", height: 3, borderRadius: 2, backgroundColor: "#edf5ff", borderWidth: 0.5, borderColor: "#769abd" },
});
