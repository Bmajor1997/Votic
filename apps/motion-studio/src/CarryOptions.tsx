import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useMemo } from "react";
import { MOTION } from "../../mobile/src/motion/motionSpec";
import { HOME_ROBOT_TIMELINE as timeline } from "../../mobile/src/motion/homeLogoTimeline";
import {
  ROBOT,
  ROBOT_BEATS,
  ROBOT_END,
  robot_pose,
  type RobotPose,
} from "../../mobile/src/motion/robotCarrier";

/**
 * Remotion study only (not the Android animation): three ways the Home robot could hold and place a letter with
 * shorter forearms. Everything except the arm and the grip comes from the app's current rig (robotCarrier.ts):
 * the same walk, planted feet, lean, squat, bow, release timing, turn and exit, so only the grip differs.
 */
export type CarryOption = "hug" | "cradle" | "hook";

export const CARRY_OPTIONS: { id: CarryOption; title: string; note: string }[] =
  [
    {
      id: "hug",
      title: "A · Chest hug",
      note: "Letter high against the chest; the arm wraps across its face. Slides it down the body to set it.",
    },
    {
      id: "cradle",
      title: "B · Low cradle",
      note: "Letter low against the belly, tipped back; the hand cups its back corner. Front edge down first, then the back, fingers slide out.",
    },
    {
      id: "hook",
      title: "C · Top hook",
      note: "Letter hangs upright from a hand hooked over its top edge and sways with each step. Squats until it touches, then lets go.",
    },
  ];

/** Short two-bone arm: upper arm and forearm lengths, shoulder in the robot's frame. */
const UPPER = 9;
const FORE = 8;
const SHOULDER = { x: 10, y: 23 };
const FONT = "900 30px Arial";

type P = { x: number; y: number };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp_point = (a: P, b: P, t: number) => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
});
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};
const within = ([a, b]: readonly [number, number], f: number) =>
  clamp01((f - a) / (b - a));
const rad = (d: number) => (d * Math.PI) / 180;
const rot = (p: P, deg: number): P => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

type Ink = {
  letter: string;
  x: number;
  width: number;
  left: number;
  right: number;
  top: number;
  base: number;
};

/** Letter layout and ink boxes, measured in the browser the same way the row lays them out. */
function useLetters(): Ink[] {
  return useMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.font = FONT;
    const vWidth = (23 * 217) / 160;
    let x = vWidth;
    return (["o", "t", "i", "c"] as const).map((letter, i) => {
      const m = ctx.measureText(letter);
      x += i === 0 ? 1 : -30 * 0.035;
      const ink = {
        letter,
        x,
        width: m.width,
        left: x - m.actualBoundingBoxLeft,
        right: x + m.actualBoundingBoxRight,
        top: 28 - m.actualBoundingBoxAscent,
        base: 28,
      };
      x += m.width;
      return ink;
    });
  }, []);
}

/** Two-bone IK with the elbow below the shoulder–hand line. Returns the elbow and the hand actually reached. */
function arm(shoulder: P, target: P) {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const dist = Math.hypot(dx, dy);
  const reach = Math.min(
    Math.max(dist, Math.abs(UPPER - FORE) + 0.01),
    UPPER + FORE - 0.001,
  );
  const ux = dx / (dist || 1);
  const uy = dy / (dist || 1);
  const along = (UPPER * UPPER - FORE * FORE + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, UPPER * UPPER - along * along));
  const a = {
    x: shoulder.x + ux * along - uy * h,
    y: shoulder.y + uy * along + ux * h,
  };
  const b = {
    x: shoulder.x + ux * along + uy * h,
    y: shoulder.y + uy * along - ux * h,
  };
  const elbow = a.y >= b.y ? a : b;
  const hand = { x: shoulder.x + ux * reach, y: shoulder.y + uy * reach };
  return { elbow, hand, gap: Math.max(0, dist - (UPPER + FORE)) };
}

type Frame = {
  base: RobotPose;
  hip: P;
  upper: number;
  to_world: (local: P) => P;
  letter: { pivot: P; at: P; angle: number };
  hand: P;
  handAngle: number;
  gap: number;
  elbow: P;
  shoulder: P;
};

/** Where everything is for one letter's robot under a given grip. */
export function carry_frame(option: CarryOption, f: number, ink: Ink): Frame {
  const base = robot_pose(f);
  // Tall letters (t, i) would tip into the face: they ride lower and more upright, and the bow to set them down
  // is shallower so the head stays clear of the placed letter. o and c are unaffected.
  const tall = option === "hug" ? clamp01((ink.base - ink.top - 17) / 4) : 0;
  const upper = base.lean + base.bow * (1 - 0.55 * tall);
  const hip = {
    x: ink.x + ink.width + 8 + base.travel + base.exit,
    y: 15 + base.drop,
  };
  const to_world = (local: P) => {
    const r = rot(
      { x: local.x - ROBOT.hip.x, y: local.y - ROBOT.hip.y },
      upper,
    );
    return { x: hip.x + base.facing * r.x, y: hip.y + r.y };
  };
  const w = ink.right - ink.left;
  const h = ink.base - ink.top;
  const back = { x: ink.right, y: ink.base };
  const front = { x: ink.left, y: ink.base };

  // Carried placement of the letter's back-bottom corner on the body, and its tilt.
  const walkSteps = (clamp01(f / ROBOT_BEATS.walk[1]) * 4) % 4;
  const carried = {
    hug: {
      local: { x: 4.6, y: 32 + 3.5 * tall },
      angle: upper * (1 - tall) - 4 * tall,
    },
    cradle: { local: { x: 4.6, y: 37 }, angle: upper + 8 },
    hook: {
      local: { x: 4.6, y: 39 },
      angle: f < ROBOT_BEATS.walk[1] ? 3 * Math.sin(Math.PI * walkSteps) : 0,
    },
  }[option];
  const carriedAt = to_world(carried.local);
  const lowerU = smooth(within(ROBOT_BEATS.lower, f));
  const loaded = f < ROBOT_BEATS.lower[1];

  let letter = { pivot: back, at: carriedAt, angle: carried.angle };
  if (!loaded) letter = { pivot: back, at: back, angle: 0 };
  else if (option !== "cradle")
    letter = {
      pivot: back,
      at: lerp_point(carriedAt, back, lowerU),
      angle: lerp(carried.angle, 0, lowerU),
    };
  else {
    // Front edge first (tipped slightly forward), then the back comes down about that edge.
    const mid = 0.66;
    const u1 = smooth(within([ROBOT_BEATS.lower[0], mid], f));
    const carriedFront = place(
      { pivot: back, at: carriedAt, angle: carried.angle },
      front,
    );
    if (f < mid)
      letter = {
        pivot: front,
        at: lerp_point(carriedFront, front, u1),
        angle: lerp(carried.angle, -6, u1),
      };
    else
      letter = {
        pivot: front,
        at: front,
        angle: lerp(-6, 0, smooth(within([mid, ROBOT_BEATS.lower[1]], f))),
      };
  }

  // Grip point on the letter, in the letter's own (final-position) coordinates.
  const grip = {
    hug: { x: ink.right - Math.min(0.4 * w, 6), y: ink.base - 0.5 * h },
    cradle: { x: ink.right - 2.2, y: ink.base + 2.3 },
    hook: { x: ink.right - Math.min(0.35 * w, 4), y: ink.top - 1.4 },
  }[option];
  let on_letter = place(letter, grip);
  if (option === "cradle" && f >= 0.66 && loaded) {
    // As the back edge comes down, the fingers slide out from under it onto the back face.
    const out = smooth(within([0.66, ROBOT_BEATS.lower[1]], f));
    on_letter = lerp_point(
      on_letter,
      place(letter, { x: ink.right + 2.3, y: ink.base - 3 }),
      out,
    );
  }

  // Letting go: off the letter (slide back / out / up), then the arm hangs and swings while walking off.
  const r1 = smooth(
    within([ROBOT_BEATS.release[0], ROBOT_BEATS.release[0] + 0.03], f),
  );
  const r2 = smooth(
    within([ROBOT_BEATS.release[0] + 0.03, ROBOT_BEATS.release[1]], f),
  );
  const off = {
    hug: { x: back.x + 2.5, y: on_letter.y + 1 },
    cradle: { x: back.x + 5, y: back.y + 1.5 },
    hook: { x: on_letter.x + 1, y: on_letter.y - 3.5 },
  }[option];
  const swing =
    f >= ROBOT_BEATS.exit[0]
      ? 3.5 * Math.sin(Math.PI * within(ROBOT_BEATS.exit, f) * 4)
      : 0;
  const rest = to_world({ x: 10.5 - swing, y: 36 });
  const shoulder = to_world(SHOULDER);
  let target = on_letter;
  if (!loaded)
    target = r2 > 0 ? lerp_point(off, rest, r2) : lerp_point(on_letter, off, r1);
  if (f >= ROBOT_BEATS.release[1]) target = rest;
  // Hands never go below the ground line.
  target = { x: target.x, y: Math.min(target.y, 26.5) };
  const solved = arm(shoulder, target);
  const handAngle = {
    hug: 0,
    cradle: letter.angle,
    hook: letter.angle,
  }[option];
  return {
    base,
    hip,
    upper,
    to_world,
    letter,
    hand: solved.hand,
    handAngle: loaded ? handAngle : 0,
    gap: loaded ? solved.gap : 0,
    elbow: solved.elbow,
    shoulder,
  };
}

/** A point given in the letter's final-position coordinates, after the letter's current move. */
function place(letter: { pivot: P; at: P; angle: number }, point: P): P {
  const r = rot(
    { x: point.x - letter.pivot.x, y: point.y - letter.pivot.y },
    letter.angle,
  );
  return { x: letter.at.x + r.x, y: letter.at.y + r.y };
}

const sample = (
  p: number,
  r: readonly [number, number],
  fr: number[],
  v: number[],
) =>
  interpolate(
    p,
    fr.map((n) => r[0] + (r[1] - r[0]) * n),
    v,
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

const SHELL = "#edf5ff";
const LINE = "#9bb6cf";

function Limb({
  from,
  to,
  fill = SHELL,
  line = LINE,
  width = ROBOT.limb,
}: {
  from: P;
  to: P;
  fill?: string;
  line?: string;
  width?: number;
}) {
  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={line}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={fill}
        strokeWidth={width - 2}
        strokeLinecap="round"
      />
    </g>
  );
}

/** One full wordmark entrance under one grip option, in wordmark pixels (row top = 0, baseline = 28). */
export function OptionWordmark({
  option,
  progress,
  dark,
  id,
}: {
  option: CarryOption;
  progress: number;
  dark: boolean;
  id: string;
}) {
  const letters = useLetters();
  const p = progress;
  const vWidth = (23 * 217) / 160;
  const ink = dark ? "#fafaf9" : "#292d32";
  const accent = dark ? "#87A7F4" : "#2563EB";
  const fade = (r: readonly [number, number]) => sample(p, r, [0, 0.6], [0, 1]);
  const slide = (r: readonly [number, number], from: number, over: number) =>
    sample(p, r, [0, 0.7, 1], [from, over, 0]);
  const wings = [
    "votic-v-wing-top.png",
    "votic-v-wing-middle.png",
    "votic-v-wing-bottom.png",
  ];
  return (
    <g>
      <g transform={`translate(0 ${34 - 6 - 23})`}>
        <image
          href={staticFile("votic-v-stroke.png")}
          width={vWidth}
          height={23}
          opacity={fade(timeline.stroke)}
          x={slide(timeline.stroke, -vWidth * 0.65, vWidth * 0.03)}
          style={{ filter: dark ? "brightness(0) invert(1)" : undefined }}
        />
        {wings.map((name, i) => (
          <g key={name}>
            <mask
              id={`${id}-w${i}`}
              maskUnits="userSpaceOnUse"
              x={-50}
              y={-50}
              width={200}
              height={200}
            >
              <image
                href={staticFile(name)}
                width={vWidth}
                height={23}
                x={slide(timeline.wings[i], vWidth * 0.35, -vWidth * 0.03)}
              />
            </mask>
            <rect
              x={-50}
              y={-50}
              width={200}
              height={200}
              fill={accent}
              mask={`url(#${id}-w${i})`}
              opacity={fade(timeline.wings[i])}
            />
          </g>
        ))}
      </g>
      {letters.map((l, i) => {
        const r = timeline.letters[i];
        const f = Math.min(ROBOT_END, Math.max(0, (p - r[0]) / (r[1] - r[0])));
        const fr = carry_frame(option, f, l);
        const { base } = fr;
        const letterOpacity = sample(p, r, [0, ROBOT_BEATS.fadeIn[1]], [0, 1]);
        const hip_local = (x: number, y: number) => ({
          x: x - ROBOT.hip.x,
          y: y - ROBOT.hip.y,
        });
        const body = `translate(${fr.hip.x} ${fr.hip.y}) scale(${base.facing} 1) rotate(${fr.upper})`;
        const legs = `translate(${fr.hip.x} ${fr.hip.y}) scale(${base.facing} 1)`;
        const leg = (side: 0 | 1) => {
          const lp = base.legs[side];
          const tone = side ? "#c6d7ea" : "#e6f0fb";
          return (
            <g key={side} transform={`rotate(${lp.thigh})`}>
              <Limb
                from={{ x: 0, y: 0 }}
                to={{ x: 0, y: ROBOT.thigh }}
                fill={tone}
                line="#8ba9c8"
              />
              <g transform={`translate(0 ${ROBOT.thigh}) rotate(${lp.knee})`}>
                <Limb
                  from={{ x: 0, y: 0 }}
                  to={{ x: 0, y: ROBOT.shin }}
                  fill={tone}
                  line="#8ba9c8"
                />
                <g transform={`translate(0 ${ROBOT.shin}) rotate(${lp.foot})`}>
                  <rect
                    x={-5}
                    y={-0.5}
                    width={7.5}
                    height={3}
                    rx={1.5}
                    fill={side ? "#8fa9c6" : "#a9c2dc"}
                  />
                </g>
              </g>
            </g>
          );
        };
        const t = hip_local(0, 0);
        const torso = ROBOT.torso;
        const head = ROBOT.head;
        const handDir = Math.atan2(
          fr.hand.y - fr.elbow.y,
          fr.hand.x - fr.elbow.x,
        );
        return (
          <g key={l.letter}>
            <g opacity={base.opacity} transform={legs}>
              {leg(1)}
              {leg(0)}
            </g>
            <g opacity={base.opacity} transform={body}>
              <g transform={`translate(${t.x} ${t.y})`}>
                <rect
                  x={torso.left + 0.5}
                  y={torso.top + 0.5}
                  width={torso.width - 1}
                  height={torso.height - 1}
                  rx={torso.radius}
                  fill={SHELL}
                  stroke={LINE}
                />
                <rect
                  x={head.left + 0.5}
                  y={head.top + 0.5}
                  width={head.width - 1}
                  height={head.height - 1}
                  rx={head.height / 2}
                  fill="#f4f8fd"
                  stroke={LINE}
                />
                <rect
                  x={head.left + 0.5}
                  y={head.top + 4}
                  width={10.5}
                  height={8.5}
                  rx={3.6}
                  fill="#163b70"
                />
                <ellipse
                  cx={head.left + 4.2}
                  cy={head.top + 8.2}
                  rx={1.5}
                  ry={1.8 * base.eye}
                  fill="white"
                />
                <rect
                  x={head.left + 11}
                  y={head.top + 5.5}
                  width={6}
                  height={7}
                  rx={3}
                  fill="#1689ec"
                />
                <ellipse
                  cx={ROBOT.sweat.left + 1.2}
                  cy={ROBOT.sweat.top + 1.7 + base.sweat.y}
                  rx={1.2}
                  ry={1.7}
                  fill="#5aaaf5"
                  opacity={base.sweat.opacity}
                />
              </g>
            </g>
            <text
              x={l.x}
              y={28}
              fill={ink}
              opacity={letterOpacity}
              style={{ font: FONT }}
              transform={`translate(${fr.letter.at.x} ${fr.letter.at.y}) rotate(${fr.letter.angle}) translate(${-fr.letter.pivot.x} ${-fr.letter.pivot.y})`}
            >
              {l.letter}
            </text>
            <g opacity={base.opacity}>
              <Limb from={fr.shoulder} to={fr.elbow} />
              <Limb from={fr.elbow} to={fr.hand} />
              <circle
                cx={fr.shoulder.x}
                cy={fr.shoulder.y}
                r={2.9}
                fill={SHELL}
                stroke={LINE}
              />
              <circle
                cx={fr.elbow.x}
                cy={fr.elbow.y}
                r={2.6}
                fill={SHELL}
                stroke={LINE}
              />
              <g
                transform={`translate(${fr.hand.x} ${fr.hand.y}) rotate(${(handDir * 180) / Math.PI})`}
              >
                <rect
                  x={-1.6}
                  y={-2.3}
                  width={5.2}
                  height={4.6}
                  rx={2.2}
                  fill={SHELL}
                  stroke={LINE}
                />
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}

const PHASES: [readonly [number, number], string][] = [
  [ROBOT_BEATS.walk, "walking in, loaded"],
  [ROBOT_BEATS.settle, "stops, braces"],
  [ROBOT_BEATS.lower, "lowering"],
  [ROBOT_BEATS.release, "lets go, stands"],
  [ROBOT_BEATS.turn, "turns (right side)"],
  [ROBOT_BEATS.exit, "walks out"],
];

/** The three options side by side, playing the same entrance in sync. */
export function CarryOptionsStudy({
  dark,
  zoom,
}: {
  dark: boolean;
  zoom: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = Math.min(1, frame / ((MOTION.homeLogo.duration * fps) / 1000));
  const bg = dark ? "#292D32" : "#FFFFFF";
  const text = dark ? "#e5e7eb" : "#1f2937";
  const muted = dark ? "#9ca3af" : "#6b7280";
  const active = timeline.letters.reduce(
    (last, r, i) => (p >= r[0] ? i : last),
    -1,
  );
  const letterF =
    active >= 0
      ? (p - timeline.letters[active][0]) /
        (timeline.letters[active][1] - timeline.letters[active][0])
      : -1;
  const phase = PHASES.find(([r]) => letterF >= r[0] && letterF < r[1])?.[1];
  const status =
    p < timeline.vSettle[1]
      ? "V assembling"
      : p >= 1
        ? "finished wordmark"
        : `${"otic"[active]} · ${phase ?? ""}`;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        fontFamily: "Arial, sans-serif",
        color: text,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 32,
          top: 18,
          right: 32,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 22,
        }}
      >
        <strong>
          Votic robot grip options · Remotion study (not the Android app)
        </strong>
        <span style={{ color: muted }}>
          {(frame / fps).toFixed(1)} s · {status}
        </span>
      </div>
      {CARRY_OPTIONS.map((option, i) => (
        <div
          key={option.id}
          style={{
            position: "absolute",
            left: 32,
            top: 70 + i * 335,
            right: 32,
            height: 320,
            borderTop: i
              ? `1px solid ${dark ? "#4b5158" : "#e5e7eb"}`
              : undefined,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 0,
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            {option.title}
          </div>
          <div
            style={{
              position: "absolute",
              top: 46,
              left: 0,
              width: 330,
              fontSize: 17,
              lineHeight: "24px",
              color: muted,
            }}
          >
            {option.note}
          </div>
          <svg
            style={{
              position: "absolute",
              left: 350,
              top: 0,
              overflow: "visible",
            }}
            width={860}
            height={320}
            viewBox={`-6 -40 ${860 / zoom} ${320 / zoom}`}
          >
            <line
              x1={-6}
              x2={860 / zoom}
              y1={28}
              y2={28}
              stroke={dark ? "#4b5158" : "#eef0f3"}
              strokeWidth={0.4}
            />
            <OptionWordmark
              option={option.id}
              progress={p}
              dark={dark}
              id={`opt${i}`}
            />
          </svg>
        </div>
      ))}
    </AbsoluteFill>
  );
}
