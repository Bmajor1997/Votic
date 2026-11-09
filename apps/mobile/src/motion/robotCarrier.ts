/**
 * The Home wordmark's carrier robot: a side-profile version of the AI Usage robot that hauls one heavy letter.
 *
 * Pure geometry with no React Native dependency, so the app and the Remotion study draw the same poses. Everything is
 * in logical pixels inside the robot's 22 × 44 frame (x right, y down, ground at y = 44), facing left. A pose is a
 * function of `f`, the fraction of the letter's own range in HOME_ROBOT_TIMELINE; the exit continues past 1.
 *
 * This module is the body: walk, planted feet (two-bone IK, so a planted foot never moves on the ground), loaded lean,
 * squat and bow to set the letter down, turn and walk-out. The grip — how the arm holds and places the letter — is in
 * carrierHug.ts.
 */

export const ROBOT = {
  frame: { width: 22, height: 44 },
  /** The frame's left edge sits this far inside the letter's right edge, pressing the chest to the letter. */
  overlap: 3,
  /** The 30 px wordmark's line box (34 px) and baseline within it. */
  lineHeight: 34,
  baseline: 28,
  ground: 44,
  hip: { x: 11, y: 31 },
  shoulder: { x: 10, y: 23 },
  /** Body shapes in the frame. The head top stays ≤ 13 px above the wordmark row, which the Home header has room for. */
  torso: { left: 4, top: 19, width: 14, height: 14.5, radius: 6.5 },
  head: { left: 2, top: 4, width: 19, height: 16.5 },
  sweat: { left: 20.5, top: 10 },
  thigh: 5.6,
  shin: 5.6,
  limb: 3.8,
  /** Ankle height above the ground when a foot is planted. */
  ankle: 2.5,
  /** Deepest squat while setting the letter down. */
  squat: 6.5,
  /** Forward bow at the hip while setting the letter down, degrees. */
  bow: -22,
} as const;

/**
 * Beats within one letter's range. Placement completes at `handoff` (72%), when the next robot starts.
 * The exit runs to 1.11 so the steps out stay visible; the next robot walks in front of it.
 */
export const ROBOT_BEATS = {
  fadeIn: [0, 0.05],
  walk: [0, 0.5],
  settle: [0.5, 0.54],
  lower: [0.54, 0.72],
  release: [0.72, 0.79],
  turn: [0.79, 0.84],
  exit: [0.84, 1.11],
  fadeOut: [1.01, 1.11],
} as const;
export const ROBOT_HANDOFF = ROBOT_BEATS.lower[1];
export const ROBOT_END = ROBOT_BEATS.exit[1];

/** Body advance per step: four slow loaded steps in, a short first step and three lighter ones out. */
export const WALK_IN_STEPS = [12, 12, 12, 12] as const;
export const WALK_OUT_STEPS = [6, 11, 11, 11] as const;
/** How far right of its place each letter and robot start. */
export const ROBOT_TRAVEL = WALK_IN_STEPS.reduce((sum, step) => sum + step, 0);

export type LegPose = {
  /** Thigh angle from straight down, degrees; positive swings the knee forward (left). */
  thigh: number;
  /** Shin rotation relative to the thigh. */
  knee: number;
  /** Foot rotation relative to the shin, keeping it flat (or toe-up during a swing). */
  foot: number;
  /** Where the ankle should be, frame coordinates (for tests and drawing guides). */
  ankle: { x: number; y: number };
  planted: boolean;
};

export type RobotPose = {
  opacity: number;
  /** Letter and robot together, px right of the letter's final place. */
  travel: number;
  /** Robot alone after placement, px right. */
  exit: number;
  /** 1 faces left (left side visible); −1 faces right. */
  facing: number;
  /** Body (hip) drop below standing, px. */
  drop: number;
  /** Upper body lean back about the hip under the load, degrees (positive = top toward the robot's back). */
  lean: number;
  /** Upper body forward bow about the hip while setting the letter down (negative = forward). */
  bow: number;
  /** Walking step count so far (fractional), for arm swing. */
  step: number;
  /** Eye height: squinting with effort while loaded. */
  eye: number;
  sweat: { opacity: number; y: number };
  /** Near (left, drawn in front) and far leg. */
  legs: [LegPose, LegPose];
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const v = clamp01(value);
  return v * v * (3 - 2 * v);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const within = ([start, end]: readonly [number, number], f: number) => clamp01((f - start) / (end - start));
const degrees = (radians: number) => (radians * 180) / Math.PI;

type Feet = [number, number];

/**
 * A walk along the robot's forward direction. Feet are positions along that direction relative to where the body
 * started; the swinging foot lands half a stride ahead of the body, and the other foot stays exactly where it is.
 */
function walk(u: number, advances: readonly number[], start: Feet, first: 0 | 1, half: number) {
  const steps = advances.length;
  const feet: Feet = [...start];
  let body = 0;
  let swing = first;
  const index = Math.min(steps - 1, Math.floor(clamp01(u) * steps));
  for (let step = 0; step < index; step++) {
    body += advances[step];
    feet[swing] = body + half;
    swing = swing === 0 ? 1 : 0;
  }
  const phase = clamp01(clamp01(u) * steps - index);
  const from = feet[swing];
  feet[swing] = lerp(from, body + advances[index] + half, smooth(phase));
  const lifts: Feet = [0, 0];
  lifts[swing] = Math.sin(Math.PI * phase);
  return { body: body + advances[index] * phase, feet, lifts, swing, phase, index };
}

/** Two-bone IK, knee forward. `dx`, `dy` locate the ankle from the hip (dx negative = forward, dy down). */
function solveLeg(dx: number, dy: number, pitch: number, planted: boolean): Omit<LegPose, "ankle"> {
  const { thigh: a, shin: b } = ROBOT;
  const reach = Math.min(Math.hypot(dx, dy), (a + b) * 0.999);
  const toward = Math.atan2(-dx, dy);
  const atHip = Math.acos(clamp((a * a + reach * reach - b * b) / (2 * a * reach), -1, 1));
  const atAnkle = Math.acos(clamp((b * b + reach * reach - a * a) / (2 * b * reach), -1, 1));
  const thigh = toward + atHip;
  const shin = toward - atAnkle;
  return { thigh: degrees(thigh), knee: degrees(shin - thigh), foot: pitch - degrees(shin), planted };
}
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The lowest the hip may sit so both ankles are within reach (with a small safety margin). */
function gaitDrop(rel: Feet, lifted: Feet) {
  const stand = ROBOT.ground - ROBOT.ankle - ROBOT.hip.y;
  const reach = (ROBOT.thigh + ROBOT.shin) * 0.98;
  return Math.max(
    0,
    ...rel.map((dx, leg) => stand - lifted[leg] - Math.sqrt(Math.max(0, reach * reach - dx * dx))),
  );
}

const IN_LIFT = 2.6;
const OUT_LIFT = 2.2;
const IN_HALF = WALK_IN_STEPS[0] / 2;
const OUT_HALF = WALK_OUT_STEPS[1] / 2;

/** Where the feet are, relative to the hip along the walking direction, and how high each is lifted (px). */
function feetAt(f: number) {
  const [walkStart, walkEnd] = ROBOT_BEATS.walk;
  if (f <= walkEnd) {
    const w = walk(within([walkStart, walkEnd], f), WALK_IN_STEPS, [-IN_HALF, IN_HALF], 0, IN_HALF);
    return {
      rel: [w.feet[0] - w.body, w.feet[1] - w.body] as Feet,
      lifted: [w.lifts[0] * IN_LIFT, w.lifts[1] * IN_LIFT] as Feet,
      body: w.body,
      exitBody: 0,
      swingPhase: w.lifts,
      step: w.index + w.phase,
    };
  }
  const [releaseStart, releaseEnd] = ROBOT_BEATS.release;
  // After the set-down the robot draws its back foot in, then its front foot, before turning.
  const mid = (releaseStart + releaseEnd) / 2;
  const back = within([releaseStart, mid], f);
  const front = within([mid, releaseEnd], f);
  const gather: Feet = [lerp(-IN_HALF, -1.5, smooth(back)), lerp(IN_HALF, 1.5, smooth(front))];
  const gatherLift: Feet = [Math.sin(Math.PI * back) * 1.6, Math.sin(Math.PI * front) * 1.6];
  if (f < ROBOT_BEATS.exit[0])
    return {
      rel: gather,
      lifted: gatherLift,
      body: ROBOT_TRAVEL,
      exitBody: 0,
      swingPhase: [0, 0] as Feet,
      step: 0,
    };
  const w = walk(within(ROBOT_BEATS.exit, f), WALK_OUT_STEPS, [-1.5, 1.5], 0, OUT_HALF);
  return {
    rel: [w.feet[0] - w.body, w.feet[1] - w.body] as Feet,
    lifted: [w.lifts[0] * OUT_LIFT, w.lifts[1] * OUT_LIFT] as Feet,
    body: ROBOT_TRAVEL,
    exitBody: w.body,
    swingPhase: w.lifts,
    step: w.index + w.phase,
  };
}

/** The pose at `f` (0 → ROBOT_END) of a letter's range. */
export function robotPose(f: number): RobotPose {
  const feet = feetAt(f);
  const loaded = f < ROBOT_HANDOFF;
  const walking = f <= ROBOT_BEATS.walk[1];
  const exiting = f >= ROBOT_BEATS.exit[0];
  const stepPhase = feet.step % 1;

  // Body drop: a loaded crouch that dips at each footfall, the squat to set the letter down, then standing up.
  const lowerU = smooth(within(ROBOT_BEATS.lower, f));
  const standU = smooth(within([ROBOT_BEATS.release[0], ROBOT_BEATS.release[0] + 0.05], f));
  const carryCrouch = walking ? 0.8 + 1.0 * (0.5 + 0.5 * Math.cos(2 * Math.PI * stepPhase)) : 1.8;
  const posture = loaded
    ? lerp(carryCrouch, ROBOT.squat, lowerU)
    : exiting
      ? 0.4 * (0.5 + 0.5 * Math.cos(2 * Math.PI * stepPhase))
      : lerp(ROBOT.squat, 0, standU);
  const drop = Math.max(posture, gaitDrop(feet.rel, feet.lifted));

  const settleU = within(ROBOT_BEATS.settle, f);
  const lean = !loaded
    ? 0
    : walking
      ? 11 + 2 * Math.cos(2 * Math.PI * stepPhase)
      : f < ROBOT_BEATS.settle[1]
        ? 13 + 1.2 * Math.sin(2 * Math.PI * 2 * settleU)
        : lerp(13, 0, lowerU);

  const bow = loaded ? ROBOT.bow * lowerU : lerp(ROBOT.bow, 0, standU);

  const fadeIn = within(ROBOT_BEATS.fadeIn, f);
  const opacity = Math.min(fadeIn, 1 - within(ROBOT_BEATS.fadeOut, f));

  const sweatU = within([0.18, 0.46], f);
  const legs = ([0, 1] as const).map((leg) => {
    const dx = -feet.rel[leg];
    const dy = ROBOT.ground - ROBOT.ankle - feet.lifted[leg] - (ROBOT.hip.y + drop);
    const lifting = feet.swingPhase[leg];
    const pitch = 12 * lifting;
    return {
      ...solveLeg(dx, dy, pitch, feet.lifted[leg] === 0),
      ankle: { x: ROBOT.hip.x + dx, y: ROBOT.hip.y + drop + dy },
    };
  }) as [LegPose, LegPose];

  return {
    opacity,
    travel: ROBOT_TRAVEL - feet.body,
    exit: feet.exitBody,
    facing: lerp(1, -1, smooth(within(ROBOT_BEATS.turn, f))),
    drop,
    lean,
    bow,
    step: exiting ? feet.step : 0,
    eye: loaded ? 0.35 : lerp(0.35, 1, smooth(within([ROBOT_HANDOFF, ROBOT_HANDOFF + 0.03], f))),
    sweat: { opacity: Math.sin(Math.PI * sweatU) * fadeIn, y: 4 * sweatU },
    legs,
  };
}

/**
 * Fractions the native app samples (React Native's interpolation is piecewise linear): dense through each step so
 * planted feet stay put, coarser where the pose barely changes.
 */
export const ROBOT_SAMPLES: readonly number[] = (() => {
  const points = new Set<number>();
  const add = ([start, end]: readonly [number, number], count: number) => {
    for (let i = 0; i <= count; i++)
      points.add(Math.round((start + ((end - start) * i) / count) * 1e6) / 1e6);
  };
  add(ROBOT_BEATS.walk, WALK_IN_STEPS.length * 12);
  add(ROBOT_BEATS.settle, 6);
  add(ROBOT_BEATS.lower, 14);
  add(ROBOT_BEATS.release, 12);
  add(ROBOT_BEATS.turn, 6);
  add(ROBOT_BEATS.exit, WALK_OUT_STEPS.length * 10);
  return [...points].sort((a, b) => a - b);
})();
