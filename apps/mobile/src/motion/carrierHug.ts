import { ROBOT, ROBOT_BEATS, ROBOT_SAMPLES, robotPose, type RobotPose } from "./robotCarrier";

/**
 * The chosen grip: a chest hug. The robot holds its letter high against its chest with one short, jointed arm
 * (shoulder → upper arm → elbow → short forearm → hand pressed on the letter's face), leaning back under the weight.
 * To place it, it squats and bows, slides the letter down its body onto the baseline, then slides its hand back off
 * and lets the arm hang. Tall letters (t, i) ride lower and stay upright, tucked under the chin, so their tops never
 * tip into the visor; the bow to set them down is shallower so the head stays clear of the placed letter.
 *
 * Pure geometry shared by the app (CarrierLetter) and the Remotion study. Coordinates are logical pixels with the
 * origin at the letter box's top-right corner, y down, the baseline (ground) at y = ROBOT.baseline. The carrier's
 * shared travel is applied separately, so these positions are relative to the letter's final place.
 */

export type CarriedLetter = "o" | "t" | "i" | "c";

/** Each letter's ink in the 30 px wordmark, measured on Android: width, height and gap to the box's right edge. */
export const LETTER_INK: Record<CarriedLetter, { width: number; height: number; rsb: number }> = {
  o: { width: 15.2, height: 16, rsb: 1.3 },
  t: { width: 9.5, height: 19.8, rsb: 1.4 },
  i: { width: 5.3, height: 22.1, rsb: 1.6 },
  c: { width: 14.1, height: 16, rsb: 1.3 },
};

/** A short two-bone arm (the old forearm ran the full width of the letter). */
export const ARM = { upper: 9, fore: 8, shoulder: { x: 10, y: 23 } } as const;

type P = { x: number; y: number };

export type HugPose = {
  body: RobotPose;
  /** The hip, where the body turns and bows. */
  hip: P;
  /** Upper body rotation about the hip: lean back (+) and bow forward (−), degrees. */
  upper: number;
  /** Letter's back-bottom ink corner, moved from its final place by (x, y), and its rotation about that corner. */
  letter: { x: number; y: number; angle: number };
  shoulder: P;
  elbow: P;
  hand: P;
  /** Bone angles from straight down, degrees (positive swings the far end toward −x). */
  upperArm: number;
  forearm: number;
  /** How far the hand falls short of where it should be (0 when the arm reaches). */
  gap: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpP = (a: P, b: P, t: number) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const within = ([a, b]: readonly [number, number], f: number) => clamp01((f - a) / (b - a));
const rad = (d: number) => (d * Math.PI) / 180;
const rot = (p: P, deg: number): P => ({
  x: p.x * Math.cos(rad(deg)) - p.y * Math.sin(rad(deg)),
  y: p.x * Math.sin(rad(deg)) + p.y * Math.cos(rad(deg)),
});
const boneAngle = (from: P, to: P) => (Math.atan2(-(to.x - from.x), to.y - from.y) * 180) / Math.PI;

/** The robot frame's top-left corner, relative to the letter box's top-right corner. */
export const FRAME_ORIGIN = { x: -ROBOT.overlap, y: ROBOT.baseline - ROBOT.frame.height } as const;

/** Two-bone IK with the elbow below the shoulder–hand line. */
function solveArm(shoulder: P, target: P) {
  const { upper, fore } = ARM;
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const reach = Math.min(Math.max(dist, Math.abs(upper - fore) + 0.01), upper + fore - 0.001);
  const ux = dx / dist;
  const uy = dy / dist;
  const along = (upper * upper - fore * fore + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, upper * upper - along * along));
  const a = { x: shoulder.x + ux * along - uy * h, y: shoulder.y + uy * along + ux * h };
  const b = { x: shoulder.x + ux * along + uy * h, y: shoulder.y + uy * along - ux * h };
  return {
    elbow: a.y >= b.y ? a : b,
    hand: { x: shoulder.x + ux * reach, y: shoulder.y + uy * reach },
    gap: Math.max(0, dist - reach),
  };
}

/** A point given in the letter's final-place coordinates, after the letter's current move. */
export function onLetter(letter: HugPose["letter"], back: P, point: P): P {
  const r = rot({ x: point.x - back.x, y: point.y - back.y }, letter.angle);
  return { x: back.x + letter.x + r.x, y: back.y + letter.y + r.y };
}

/** How tall a letter is, 0 (o, c) to 1 (i): tall letters are carried lower and upright. */
export const tallness = (letter: CarriedLetter) => clamp01((LETTER_INK[letter].height - 17) / 4);

/** The pose for `letter` at `f` (0 → ROBOT_END) of its range. */
export function hugPose(letter: CarriedLetter, f: number): HugPose {
  const body = robotPose(f);
  const ink = LETTER_INK[letter];
  const tall = tallness(letter);
  const upper = body.lean + body.bow * (1 - 0.55 * tall);
  const hip = { x: FRAME_ORIGIN.x + ROBOT.hip.x + body.exit, y: FRAME_ORIGIN.y + ROBOT.hip.y + body.drop };
  const toWorld = (local: P) => {
    const r = rot({ x: local.x - ROBOT.hip.x, y: local.y - ROBOT.hip.y }, upper);
    return { x: hip.x + body.facing * r.x, y: hip.y + r.y };
  };
  const back = { x: -ink.rsb, y: ROBOT.baseline };
  const loaded = f < ROBOT_BEATS.lower[1];

  // Carried: the letter's back-bottom corner against the lower chest, leaning back with the body (tall letters upright).
  const carriedAt = toWorld({ x: 4.6, y: 32 + 3.5 * tall });
  const carriedAngle = upper * (1 - tall) - 4 * tall;
  const lowerU = smooth(within(ROBOT_BEATS.lower, f));
  const at = loaded ? lerpP(carriedAt, back, lowerU) : back;
  const letterMove = {
    x: at.x - back.x,
    y: at.y - back.y,
    angle: loaded ? lerp(carriedAngle, 0, lowerU) : 0,
  };

  // The hand on the letter's face, nearer its back edge, halfway up.
  const grip = onLetter(letterMove, back, {
    x: back.x - Math.min(0.4 * ink.width, 6),
    y: back.y - 0.5 * ink.height,
  });
  // Letting go: the hand slides back off the letter, then the arm hangs and swings while walking away.
  const slide = smooth(within([ROBOT_BEATS.release[0], ROBOT_BEATS.release[0] + 0.03], f));
  const hang = smooth(within([ROBOT_BEATS.release[0] + 0.03, ROBOT_BEATS.release[1]], f));
  const off = { x: back.x + 2.5, y: grip.y + 1 };
  const rest = toWorld({ x: 10.5 - 3.5 * Math.sin(Math.PI * body.step), y: 36 });
  let target = loaded ? grip : hang > 0 ? lerpP(off, rest, hang) : lerpP(grip, off, slide);
  if (f >= ROBOT_BEATS.release[1]) target = rest;
  // A hand never goes below the ground.
  target = { x: target.x, y: Math.min(target.y, ROBOT.baseline - 1.5) };

  const shoulder = toWorld(ARM.shoulder);
  const arm = solveArm(shoulder, target);
  return {
    body,
    hip,
    upper,
    letter: letterMove,
    shoulder,
    elbow: arm.elbow,
    hand: arm.hand,
    upperArm: boneAngle(shoulder, arm.elbow),
    forearm: boneAngle(arm.elbow, arm.hand),
    gap: loaded ? arm.gap : 0,
  };
}

/** Sampled poses for each letter, computed once for the app's piecewise-linear interpolation. */
export const HUG_TRACKS: Record<CarriedLetter, readonly HugPose[]> = {
  o: ROBOT_SAMPLES.map((f) => hugPose("o", f)),
  t: ROBOT_SAMPLES.map((f) => hugPose("t", f)),
  i: ROBOT_SAMPLES.map((f) => hugPose("i", f)),
  c: ROBOT_SAMPLES.map((f) => hugPose("c", f)),
};
