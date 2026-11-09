import { CanvasImage, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { MOTION } from "../../mobile/src/motion/motionSpec";
import { HOME_ROBOT_TIMELINE as timeline } from "../../mobile/src/motion/homeLogoTimeline";
import type { CSSProperties } from "react";

type Range = readonly [number, number];
const t = ([start, end]: Range, fraction: number) => start + (end - start) * fraction;
const sample = (p: number, r: Range, fractions: number[], values: number[]) => interpolate(p, fractions.map((n) => t(r, n)), values, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const abs: CSSProperties = { position: "absolute" };

/** Visual study of the native wordmark. Confirm actual layout and movement on a device. */
export function RobotWordmark({ dark, settled }: { dark: boolean; settled: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = settled ? 1 : Math.min(1, frame / (MOTION.homeLogo.duration * fps / 1000));
  const fade = (r: Range) => sample(p, r, [0, .6], [0, 1]);
  const vWidth = 23 * 217 / 160;
  const layers = ["votic-v-stroke.png", "votic-v-wing-top.png", "votic-v-wing-middle.png", "votic-v-wing-bottom.png"];
  const ranges = [timeline.stroke, ...timeline.wings];
  return <div style={{ display: "flex", alignItems: "flex-end", height: 34, color: dark ? "#fafaf9" : "#292d32", scale: sample(p, timeline.finish, [0, .45, 1], [1, 1.035, 1]), pointerEvents: "none" }}>
    <div style={{ position: "relative", width: vWidth, height: 23, marginBottom: 6, scale: sample(p, timeline.vSettle, [0, .5, 1], [1, 1.05, 1]) }}>
      {layers.map((name, i) => <CanvasImage key={name} src={staticFile(name)} premountFor={fps} style={{ ...abs, width: vWidth, height: 23, opacity: fade(ranges[i]), translate: `${sample(p, ranges[i], [0, .7, 1], i ? [vWidth * .35, -vWidth * .03, 0] : [-vWidth * .65, vWidth * .03, 0])}px 0`, filter: i === 0 && dark ? "brightness(0) invert(1)" : undefined }} />)}
    </div>
    {(["o", "t", "i", "c"] as const).map((letter, i) => {
      const r = timeline.letters[i];
      const travel = sample(p, r, [0, .62, 1], [72, 0, 0]);
      const rx = sample(p, r, [0, .62, .79, 1], [72, 0, 0, 90]);
      const direction = sample(p, r, [0, .73, .79, 1], [1, 1, -1, -1]);
      const tilt = sample(p, r, [0, .18, .36, .54, .62, .72, 1], [22, 28, 22, 28, 16, 0, 0]);
      const glyphTilt = sample(p, r, [0, .62, .72, 1], [-12, -12, 0, 0]);
      const glyphY = sample(p, r, [0, .62, .72, 1], [-3, -3, 0, 0]);
      // Exaggerate the load only while carrying; placement restores the normal wordmark size.
      const loadScale = sample(p, r, [0, .62, .72, 1], [1.4, 1.4, 1, 1]);
      const fractions = [0, .16, .32, .48, .62, .79, .86, .93, 1];
      return <div key={letter} style={{ position: "relative", marginLeft: i ? -1.05 : 1 }}>
        <div style={{ ...abs, left: 13, top: -5, width: 28, height: 28, opacity: sample(p, r, [0, .12, .95, 1], [0, 1, 1, 0]), translate: `${rx}px 0`, scale: `${direction * 1.3} 1.3`, transformOrigin: "50% 90%" }}>
          {[0, 1].map((side) => <div key={side} style={{ ...abs, left: side ? 14 : 12, top: 20, width: 5, height: 9, boxSizing: "border-box", borderRadius: 3, background: "#dbe8f5", border: "1px solid #8ba9c8", translate: `${sample(p, r, fractions, side ? [-5, 5, -5, 5, 0, 0, 5, -5, 0] : [5, -5, 5, -5, 0, 0, -5, 5, 0])}px ${sample(p, r, fractions, side ? [0, -6, 0, -6, 0, 0, -6, 0, 0] : [-6, 0, -6, 0, 0, 0, 0, -6, 0])}px`, rotate: `${sample(p, r, fractions, side ? [-30, 30, -30, 30, 0, 0, 30, -30, 0] : [30, -30, 30, -30, 0, 0, -30, 30, 0])}deg` }}><div style={{ ...abs, left: -3, bottom: -1, width: 8, height: 4, borderRadius: 2, background: "#9bb9d7" }} /></div>)}
          <div style={{ ...abs, width: 28, height: 28, rotate: `${tilt}deg` }}>
            <div style={{ ...abs, top: 14, left: 10, width: 13, height: 10, boxSizing: "border-box", borderRadius: 5, background: "#dbeaff", border: "1px solid #9bb6cf" }} />
            <div style={{ ...abs, top: 0, left: 6, width: 19, height: 16, boxSizing: "border-box", borderRadius: 8, background: "#edf5ff", border: "1px solid #9bb6cf" }}><div style={{ ...abs, top: 4, left: -1, width: 11, height: 8, borderRadius: 5, background: "#163b70" }}><div style={{ ...abs, top: 2, left: 3, width: 3, height: 3, borderRadius: 2, background: "white" }} /></div><div style={{ ...abs, top: 4, right: -3, width: 5, height: 7, borderRadius: 3, background: "#1689ec" }} /></div>
            <div style={{ ...abs, top: 16, left: 2, width: 13, height: 5, boxSizing: "border-box", borderRadius: 3, background: "#edf5ff", border: "1px solid #9bb6cf", rotate: "-18deg" }} />
          </div>
        </div>
        <div style={{ position: "relative", translate: `${travel}px ${glyphY}px`, rotate: `${glyphTilt}deg`, scale: loadScale, transformOrigin: "100% 75%" }}>
          <span style={{ display: "block", fontSize: 30, lineHeight: "34px", fontWeight: 900, opacity: fade(r) }}>{letter}</span>
          <svg aria-hidden="true" viewBox="0 0 100 25" preserveAspectRatio="none" style={{ ...abs, left: 0, width: "calc(100% + 11px)", bottom: 2, height: 18, overflow: "visible", opacity: sample(p, r, [0, .12, .62, .72, 1], [0, 1, 1, 0, 0]) }}>
            {/* A single bent profile arm: upper arm joins the robot, forearm supports the load. */}
            <path d="M 93 3 C 89 7 98 13 86 17 L 27 20" fill="none" stroke="#769abd" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d="M 93 3 C 89 7 98 13 86 17 L 27 20" fill="none" stroke="#edf5ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>;
    })}
  </div>;
}
