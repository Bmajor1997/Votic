import {
  CanvasImage,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { MOTION } from "../../mobile/src/motion/motionSpec";
import { HOME_ROBOT_TIMELINE as timeline } from "../../mobile/src/motion/homeLogoTimeline";
import {
  ROBOT,
  ROBOT_END,
  ROBOT_BEATS,
} from "../../mobile/src/motion/robotCarrier";
import {
  ARM,
  LETTER_INK,
  hugPose,
  type CarriedLetter,
  type HugPose,
} from "../../mobile/src/motion/carrierHug";

type Range = readonly [number, number];
const t = ([start, end]: Range, fraction: number) =>
  start + (end - start) * fraction;
const sample = (p: number, r: Range, fractions: number[], values: number[]) =>
  interpolate(
    p,
    fractions.map((n) => t(r, n)),
    values,
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
const abs: CSSProperties = { position: "absolute", boxSizing: "border-box" };
const { frame, overlap, baseline, hip, thigh, shin, limb } = ROBOT;

/** The Home entrance's progress (0 → 1) at the current frame. */
export function useEntranceProgress(settled: boolean) {
  const frameNumber = useCurrentFrame();
  const { fps } = useVideoConfig();
  return settled
    ? 1
    : Math.min(1, frameNumber / ((MOTION.homeLogo.duration * fps) / 1000));
}

/**
 * The native wordmark (VoticWordmark + CarrierLetter) redrawn with the same pose function, element structure and
 * transform order, so this study and the Android app show the same motion. Confirm the final result on a device.
 */
export function RobotWordmark({
  dark,
  progress,
  guides = false,
}: {
  dark: boolean;
  progress: number;
  guides?: boolean;
}) {
  const { fps } = useVideoConfig();
  const p = progress;
  const fade = (r: Range) => sample(p, r, [0, 0.6], [0, 1]);
  const vWidth = (23 * 217) / 160;
  const layers = [
    "votic-v-stroke.png",
    "votic-v-wing-top.png",
    "votic-v-wing-middle.png",
    "votic-v-wing-bottom.png",
  ];
  const ranges = [timeline.stroke, ...timeline.wings];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        height: 34,
        color: dark ? "#fafaf9" : "#292d32",
        scale: sample(p, timeline.finish, [0, 0.45, 1], [1, 1.035, 1]),
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: vWidth,
          height: 23,
          marginBottom: 6,
          scale: sample(p, timeline.vSettle, [0, 0.5, 1], [1, 1.05, 1]),
        }}
      >
        {layers.map((name, i) => {
          const style: CSSProperties = {
            ...abs,
            width: vWidth,
            height: 23,
            opacity: fade(ranges[i]),
            translate: `${sample(p, ranges[i], [0, 0.7, 1], i ? [vWidth * 0.35, -vWidth * 0.03, 0] : [-vWidth * 0.65, vWidth * 0.03, 0])}px 0`,
          };
          // The wings are white artwork the app tints with theme.logoWing; the stroke is dark (white in dark mode).
          if (i)
            return (
              <div
                key={name}
                style={{
                  ...style,
                  background: dark ? "#87A7F4" : "#2563EB",
                  maskImage: `url(${staticFile(name)})`,
                  maskSize: "100% 100%",
                }}
              />
            );
          return (
            <CanvasImage
              key={name}
              src={staticFile(name)}
              premountFor={fps}
              style={{
                ...style,
                filter: dark ? "brightness(0) invert(1)" : undefined,
              }}
            />
          );
        })}
      </div>
      {(["o", "t", "i", "c"] as const).map((letter, i) => {
        const r = timeline.letters[i];
        const f = (p - r[0]) / (r[1] - r[0]);
        const pose = hugPose(letter, Math.min(ROBOT_END, Math.max(0, f)));
        const letterOpacity = sample(p, r, [0, ROBOT_BEATS.fadeIn[1]], [0, 1]);
        return (
          <Carrier
            key={letter}
            letter={letter}
            pose={pose}
            marginLeft={i ? -30 * 0.035 : Math.round(30 * 0.04)}
            guides={guides}
          >
            <span
              style={{
                display: "block",
                fontFamily: "Roboto, Arial, sans-serif",
                fontSize: 30,
                lineHeight: "34px",
                fontWeight: 900,
                opacity: letterOpacity,
              }}
            >
              {letter}
            </span>
          </Carrier>
        );
      })}
    </div>
  );
}

const shell: CSSProperties = {
  background: "#edf5ff",
  border: "1px solid #9bb6cf",
};
const round = (size: number): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: size / 2,
});
/** A bone drawn from its origin downward and rotated about it (as CarrierLetter's `bone`). */
const bone = (length: number): CSSProperties => ({
  ...abs,
  left: -limb / 2,
  top: -limb / 2,
  width: limb,
  height: length + limb,
  borderRadius: limb / 2,
  transformOrigin: `${limb / 2}px ${limb / 2}px`,
});

/** CarrierLetter's layers and transforms, in CSS. */
function Carrier({
  letter,
  pose,
  marginLeft,
  children,
  guides,
}: {
  letter: CarriedLetter;
  pose: HugPose;
  marginLeft: number;
  children: ReactNode;
  guides: boolean;
}) {
  const { body } = pose;
  const pivot = { x: -LETTER_INK[letter].rsb, y: baseline - ROBOT.lineHeight };
  const frameStyle: CSSProperties = {
    ...abs,
    width: frame.width,
    height: frame.height,
    right: -(frame.width - overlap),
    top: baseline - frame.height,
    transformOrigin: `${hip.x}px ${hip.y}px`,
  };
  const leg = (side: 0 | 1) => {
    const tone = side
      ? { background: "#c6d7ea", borderColor: "#8ba9c8" }
      : { background: "#e6f0fb", borderColor: "#8ba9c8" };
    const l = body.legs[side];
    return (
      <div
        key={side}
        style={{
          ...bone(thigh),
          ...tone,
          borderStyle: "solid",
          borderWidth: 1,
          left: hip.x - limb / 2,
          top: hip.y - limb / 2,
          transform: `rotate(${l.thigh}deg)`,
        }}
      >
        <div
          style={{
            ...bone(shin),
            ...tone,
            borderStyle: "solid",
            borderWidth: 1,
            left: -1,
            top: thigh - 1,
            transform: `rotate(${l.knee}deg)`,
          }}
        >
          <div
            style={{
              ...abs,
              left: limb / 2 - 5 - 1,
              top: limb / 2 + shin - 0.5 - 1,
              width: 7.5,
              height: 3,
              borderRadius: 1.5,
              background: side ? "#8fa9c6" : "#a9c2dc",
              transformOrigin: "5px 0.5px",
              transform: `rotate(${l.foot}deg)`,
            }}
          />
        </div>
      </div>
    );
  };
  return (
    <div
      style={{
        position: "relative",
        marginLeft,
        transform: `translateX(${body.travel}px)`,
      }}
    >
      <div
        style={{
          ...frameStyle,
          opacity: body.opacity,
          transform: `translateX(${body.exit}px) scaleX(${body.facing})`,
        }}
      >
        <div
          style={{ ...abs, inset: 0, transform: `translateY(${body.drop}px)` }}
        >
          {leg(1)}
          {leg(0)}
        </div>
      </div>
      <div
        style={{
          ...frameStyle,
          opacity: body.opacity,
          transform: `translateX(${body.exit}px) translateY(${body.drop}px) scaleX(${body.facing}) rotate(${pose.upper}deg)`,
        }}
      >
        <div
          style={{
            ...abs,
            ...shell,
            left: ROBOT.torso.left,
            top: ROBOT.torso.top,
            width: ROBOT.torso.width,
            height: ROBOT.torso.height,
            borderRadius: ROBOT.torso.radius,
          }}
        />
        <div
          style={{
            ...abs,
            ...shell,
            background: "#f4f8fd",
            left: ROBOT.head.left,
            top: ROBOT.head.top,
            width: ROBOT.head.width,
            height: ROBOT.head.height,
            borderRadius: ROBOT.head.height / 2,
          }}
        >
          <div
            style={{
              ...abs,
              left: -0.5,
              top: 3,
              width: 10.5,
              height: 8.5,
              background: "#163b70",
              borderRadius: "4.25px 3px 3px 4.25px",
            }}
          >
            <div
              style={{
                ...abs,
                left: 2.2,
                top: 2.4,
                width: 3,
                height: 3.6,
                borderRadius: 1.5,
                background: "white",
                transform: `scaleY(${body.eye})`,
              }}
            />
          </div>
          <div
            style={{
              ...abs,
              left: 10,
              top: 4.5,
              width: 6,
              height: 7,
              borderRadius: 3,
              background: "#1689ec",
            }}
          />
        </div>
        <div
          style={{
            ...abs,
            left: ROBOT.sweat.left,
            top: ROBOT.sweat.top,
            width: 2.4,
            height: 3.4,
            borderRadius: 1.2,
            background: "#5aaaf5",
            opacity: body.sweat.opacity,
            transform: `translateY(${body.sweat.y}px)`,
          }}
        />
      </div>
      <div
        style={{
          position: "relative",
          transformOrigin: "100% 100%",
          transform: `translateX(${pose.letter.x}px) translateY(${pose.letter.y}px) translateX(${pivot.x}px) translateY(${pivot.y}px) rotate(${pose.letter.angle}deg) translateX(${-pivot.x}px) translateY(${-pivot.y}px)`,
        }}
      >
        {children}
      </div>
      <div style={{ ...abs, left: "100%", top: 0, width: 0, height: 0 }}>
        <div
          style={{
            ...bone(ARM.upper),
            ...shell,
            opacity: body.opacity,
            transform: `translateX(${pose.shoulder.x}px) translateY(${pose.shoulder.y}px) rotate(${pose.upperArm}deg)`,
          }}
        >
          <div
            style={{
              ...abs,
              ...shell,
              ...round(5.8),
              left: limb / 2 - 2.9 - 1,
              top: limb / 2 - 2.9 - 1,
            }}
          />
        </div>
        <div
          style={{
            ...bone(ARM.fore),
            ...shell,
            opacity: body.opacity,
            transform: `translateX(${pose.elbow.x}px) translateY(${pose.elbow.y}px) rotate(${pose.forearm}deg)`,
          }}
        >
          <div
            style={{
              ...abs,
              ...shell,
              ...round(5.2),
              left: limb / 2 - 2.6 - 1,
              top: limb / 2 - 2.6 - 1,
            }}
          />
          <div
            style={{
              ...abs,
              ...shell,
              left: limb / 2 - 2.3 - 1,
              top: limb / 2 + ARM.fore - 1.6 - 1,
              width: 4.6,
              height: 5.2,
              borderRadius: 2.2,
            }}
          />
        </div>
      </div>
      {guides ? (
        <div
          style={{
            ...abs,
            left: -40,
            right: -90,
            top: baseline,
            height: 0,
            borderTop: "0.5px dashed #e11d48",
          }}
        />
      ) : null}
    </div>
  );
}
