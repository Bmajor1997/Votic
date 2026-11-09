import { useMemo, type ReactNode } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { ROBOT, ROBOT_SAMPLES } from "../motion/robotCarrier";
import { ARM, HUG_TRACKS, LETTER_INK, type CarriedLetter, type HugPose } from "../motion/carrierHug";

type Range = readonly [number, number];

/**
 * Home wordmark: one letter, carried in by its own side-profile robot in a chest hug (see ../motion/carrierHug.ts).
 *
 * Layers, back to front: legs (feet on the ground), the body (leans back under the load, bows to set it down), the
 * letter (moved and tilted about its back-bottom corner), then the short jointed arm whose hand rests on the letter.
 * Every value is sampled from the shared pose function and driven by the wordmark's one entrance value on the
 * native driver.
 */
export function CarrierLetter({
  letter,
  range,
  progress,
  marginLeft,
  children,
}: {
  letter: CarriedLetter;
  range: Range;
  progress: Animated.Value;
  marginLeft: number;
  /** The letter's text, already styled. */
  children: ReactNode;
}) {
  // Each wordmark builds its own nodes: React Native's animated nodes aren't meant to be shared once detached.
  const t = useMemo(() => build_motion(progress, letter, range), [progress, range, letter]);

  // The letter turns about its back-bottom ink corner; the wrapper's transform origin is its bottom-right corner.
  const pivot = { x: -LETTER_INK[letter].rsb, y: ROBOT.baseline - ROBOT.lineHeight };
  const hidden = {
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants" as const,
  };
  const leg = (side: 0 | 1) => (
    <Animated.View
      key={side}
      testID={`votic-robot-leg-${letter}-${side}`}
      style={[s.thigh, side ? s.farLimb : s.nearLimb, { transform: [{ rotate: t.legs[side].thigh }] }]}
    >
      <Animated.View
        style={[s.shin, side ? s.farLimb : s.nearLimb, { transform: [{ rotate: t.legs[side].knee }] }]}
      >
        <Animated.View
          testID={`votic-robot-foot-${letter}-${side}`}
          style={[s.foot, side ? s.farFoot : s.nearFoot, { transform: [{ rotate: t.legs[side].foot }] }]}
        />
      </Animated.View>
    </Animated.View>
  );

  return (
    <Animated.View
      testID={`votic-robot-carrier-${letter}`}
      pointerEvents="none"
      style={{ marginLeft, transform: [{ translateX: t.travel }] }}
    >
      <Animated.View
        testID={`votic-robot-legs-${letter}`}
        {...hidden}
        style={[s.frame, { opacity: t.opacity, transform: [{ translateX: t.exit }, { scaleX: t.facing }] }]}
      >
        <Animated.View style={[s.fill, { transform: [{ translateY: t.drop }] }]}>
          {leg(1)}
          {leg(0)}
        </Animated.View>
      </Animated.View>
      <Animated.View
        testID={`votic-wordmark-robot-${letter}`}
        {...hidden}
        style={[
          s.frame,
          {
            opacity: t.opacity,
            transform: [
              { translateX: t.exit },
              { translateY: t.drop },
              { scaleX: t.facing },
              { rotate: t.upper },
            ],
          },
        ]}
      >
        <View style={s.torso} />
        <View testID={`votic-robot-profile-${letter}`} style={s.head}>
          <View style={s.visor}>
            <Animated.View style={[s.eye, { transform: [{ scaleY: t.eye }] }]} />
          </View>
          <View style={s.ear} />
        </View>
        <Animated.View style={[s.sweat, { opacity: t.sweat, transform: [{ translateY: t.sweatY }] }]} />
      </Animated.View>
      <Animated.View
        testID={`votic-robot-letter-${letter}`}
        style={{
          transformOrigin: ["100%", "100%", 0],
          transform: [
            { translateX: t.letterX },
            { translateY: t.letterY },
            { translateX: pivot.x },
            { translateY: pivot.y },
            { rotate: t.letterAngle },
            { translateX: -pivot.x },
            { translateY: -pivot.y },
          ],
        }}
      >
        {children}
      </Animated.View>
      {/* The arm is placed in the letter box's top-right corner coordinates, like the pose function. */}
      <View style={s.origin} {...hidden}>
        <Animated.View
          testID={`votic-robot-arm-${letter}`}
          style={[
            s.upperArm,
            {
              opacity: t.opacity,
              transform: [{ translateX: t.shoulderX }, { translateY: t.shoulderY }, { rotate: t.upperArm }],
            },
          ]}
        >
          <View style={s.shoulder} />
        </Animated.View>
        <Animated.View
          testID={`votic-robot-forearm-${letter}`}
          style={[
            s.forearm,
            {
              opacity: t.opacity,
              transform: [{ translateX: t.elbowX }, { translateY: t.elbowY }, { rotate: t.forearm }],
            },
          ]}
        >
          <View style={s.elbow} />
          <View testID={`votic-robot-hand-${letter}`} style={s.hand} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function build_motion(progress: Animated.Value, letter: CarriedLetter, range: Range) {
  const inputRange = ROBOT_SAMPLES.map((f) => range[0] + (range[1] - range[0]) * f);
  const track = HUG_TRACKS[letter];
  const value = (pick: (pose: HugPose) => number) =>
    progress.interpolate({ inputRange, outputRange: track.map(pick), extrapolate: "clamp" });
  const angle = (pick: (pose: HugPose) => number) =>
    progress.interpolate({
      inputRange,
      outputRange: track.map((pose) => `${pick(pose)}deg`),
      extrapolate: "clamp",
    });
  return {
    opacity: value((p) => p.body.opacity),
    travel: value((p) => p.body.travel),
    exit: value((p) => p.body.exit),
    facing: value((p) => p.body.facing),
    drop: value((p) => p.body.drop),
    upper: angle((p) => p.upper),
    letterX: value((p) => p.letter.x),
    letterY: value((p) => p.letter.y),
    letterAngle: angle((p) => p.letter.angle),
    shoulderX: value((p) => p.shoulder.x),
    shoulderY: value((p) => p.shoulder.y),
    upperArm: angle((p) => p.upperArm),
    elbowX: value((p) => p.elbow.x),
    elbowY: value((p) => p.elbow.y),
    forearm: angle((p) => p.forearm),
    eye: value((p) => p.body.eye),
    sweat: value((p) => p.body.sweat.opacity),
    sweatY: value((p) => p.body.sweat.y),
    legs: ([0, 1] as const).map((leg) => ({
      thigh: angle((p) => p.body.legs[leg].thigh),
      knee: angle((p) => p.body.legs[leg].knee),
      foot: angle((p) => p.body.legs[leg].foot),
    })),
  };
}

const { frame, hip, thigh, shin, limb } = ROBOT;
const shell = { backgroundColor: "#edf5ff", borderWidth: 1, borderColor: "#9bb6cf" } as const;
const joint = (size: number) => ({ width: size, height: size, borderRadius: size / 2 });
// A bone drawn from its origin downward, rotated about that origin.
const bone = (length: number): ViewStyle => ({
  position: "absolute",
  left: -limb / 2,
  top: -limb / 2,
  width: limb,
  height: length + limb,
  borderRadius: limb / 2,
  transformOrigin: [limb / 2, limb / 2, 0],
});

const s = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  // Zero-size anchor at the letter box's top-right corner.
  origin: { position: "absolute", left: "100%", top: 0, width: 0, height: 0 },
  // The robot's frame: its left edge pressed just inside the letter's right edge, its ground on the baseline.
  frame: {
    position: "absolute",
    width: frame.width,
    height: frame.height,
    right: -(frame.width - ROBOT.overlap),
    top: ROBOT.baseline - frame.height,
    // Turning, the lean and the bow all pivot on the hip.
    transformOrigin: [hip.x, hip.y, 0],
  },
  torso: {
    ...shell,
    position: "absolute",
    left: ROBOT.torso.left,
    top: ROBOT.torso.top,
    width: ROBOT.torso.width,
    height: ROBOT.torso.height,
    borderRadius: ROBOT.torso.radius,
  },
  head: {
    ...shell,
    backgroundColor: "#f4f8fd",
    position: "absolute",
    left: ROBOT.head.left,
    top: ROBOT.head.top,
    width: ROBOT.head.width,
    height: ROBOT.head.height,
    borderRadius: ROBOT.head.height / 2,
  },
  // Facing left: the dark visor wraps the front of the helmet; the blue ear cap sits on the visible side.
  visor: {
    position: "absolute",
    left: -0.5,
    top: 3,
    width: 10.5,
    height: 8.5,
    backgroundColor: "#163b70",
    borderTopLeftRadius: 4.25,
    borderBottomLeftRadius: 4.25,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  eye: {
    position: "absolute",
    left: 2.2,
    top: 2.4,
    width: 3,
    height: 3.6,
    borderRadius: 1.5,
    backgroundColor: "#fff",
  },
  ear: {
    position: "absolute",
    left: 10,
    top: 4.5,
    width: 6,
    height: 7,
    borderRadius: 3,
    backgroundColor: "#1689ec",
  },
  sweat: {
    position: "absolute",
    left: ROBOT.sweat.left,
    top: ROBOT.sweat.top,
    width: 2.4,
    height: 3.4,
    borderRadius: 1.2,
    backgroundColor: "#5aaaf5",
  },
  thigh: { ...bone(thigh), left: hip.x - limb / 2, top: hip.y - limb / 2, borderWidth: 1 },
  shin: { ...bone(shin), left: -1, top: thigh - 1, borderWidth: 1 },
  // Toe forward (left) of the ankle; the sole is on the ground when the ankle is ROBOT.ankle above it.
  foot: {
    position: "absolute",
    left: limb / 2 - 5 - 1,
    top: limb / 2 + shin - 0.5 - 1,
    width: 7.5,
    height: 3,
    borderRadius: 1.5,
    transformOrigin: [5, 0.5, 0],
  },
  nearLimb: { backgroundColor: "#e6f0fb", borderColor: "#8ba9c8" },
  farLimb: { backgroundColor: "#c6d7ea", borderColor: "#8ba9c8" },
  nearFoot: { backgroundColor: "#a9c2dc" },
  farFoot: { backgroundColor: "#8fa9c6" },
  upperArm: { ...bone(ARM.upper), ...shell },
  forearm: { ...bone(ARM.fore), ...shell },
  // Joints sit over the bone ends, inside the bone's border.
  shoulder: {
    ...shell,
    ...joint(5.8),
    position: "absolute",
    left: limb / 2 - 2.9 - 1,
    top: limb / 2 - 2.9 - 1,
  },
  elbow: { ...shell, ...joint(5.2), position: "absolute", left: limb / 2 - 2.6 - 1, top: limb / 2 - 2.6 - 1 },
  // The hand continues the forearm past the wrist, resting on the letter.
  hand: {
    ...shell,
    position: "absolute",
    left: limb / 2 - 2.3 - 1,
    top: limb / 2 + ARM.fore - 1.6 - 1,
    width: 4.6,
    height: 5.2,
    borderRadius: 2.2,
  },
});
