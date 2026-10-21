import type { CSSProperties, PropsWithChildren } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { MOTION, playback_slices } from "../../mobile/src/motion/motionSpec";

export type MotionProps = { dark: boolean; reducedMotion: boolean };
type Kind =
  "document" | "mode" | "playback" | "import" | "finish" | "bookmark" | "note";
const light = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  muted: "#F5F5F4",
  text: "#292D32",
  secondary: "#626262",
  border: "#E5E7EB",
  accent: "#B45309",
  tint: "#FEF3E7",
};
const dark = {
  background: "#292D32",
  surface: "#32373D",
  muted: "#24282D",
  text: "#FAFAF9",
  secondary: "#D1D5DB",
  border: "#4B5158",
  accent: "#E9A66F",
  tint: "#514034",
};
type Palette = typeof light;
const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.215, 0.61, 0.355, 1),
} as const;
const sample =
  "A good idea becomes clearer when you give it room. Read at your own pace, or listen and let the words come to you.";
const title = "A little space to think";
const labels: Record<Kind, string> = {
  document: "Document → Reader",
  mode: "Read ↔ Listen",
  playback: "Play ↔ Pause",
  import: "Import → Saved document",
  finish: "Finish experience",
  bookmark: "Bookmark feedback",
  note: "Note saved",
};
function useTimeline(reduced: boolean) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (start: number, duration: number) =>
    reduced
      ? frame >= (start * fps) / 1000
        ? 1
        : 0
      : interpolate(
          frame,
          [(start * fps) / 1000, ((start + duration) * fps) / 1000],
          [0, 1],
          clamp,
        );
}
function Card({
  children,
  p,
  style,
}: PropsWithChildren<{ p: Palette; style?: CSSProperties }>) {
  return (
    <div
      style={{
        padding: 20,
        border: `1px solid ${p.border}`,
        borderRadius: 20,
        background: p.surface,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function PlayGlyph({ progress, color }: { progress: number; color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24">
      {playback_slices().map((s, i) => (
        <rect
          key={i}
          x={
            12 +
            s.fromX +
            (s.toX - s.fromX) * progress -
            (s.fromWidth + (s.toWidth - s.fromWidth) * progress) / 2
          }
          y={12 + s.y - s.height / 2}
          width={s.fromWidth + (s.toWidth - s.fromWidth) * progress}
          height={s.height}
          fill={color}
        />
      ))}
    </svg>
  );
}
function Bookmark({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg width="24" height="28" viewBox="0 0 24 28">
      <path
        d="M5 3 H19 V25 L12 20 L5 25 Z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Reader({
  p,
  listening,
  play = 0,
  hideTitle = false,
}: {
  p: Palette;
  listening: number;
  play?: number;
  hideTitle?: boolean;
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 52,
        }}
      >
        <span style={{ fontSize: 26 }}>⌄</span>
        <span style={{ color: p.secondary, fontSize: 12, letterSpacing: 2 }}>
          READING
        </span>
        <Bookmark filled={false} color={p.text} />
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          width: 176,
          height: 48,
          borderRadius: 24,
          background: p.muted,
          alignItems: "center",
          textAlign: "center",
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "3px auto 3px 3px",
            width: 82,
            borderRadius: 22,
            background: p.tint,
            translate: `${listening * MOTION.mode.pillWidth}px 0`,
          }}
        />
        <span style={{ position: "relative", width: 88 }}>Read</span>
        <span style={{ position: "relative", width: 88 }}>Listen</span>
      </div>
      <h2
        style={{
          fontSize: 19,
          lineHeight: "24px",
          marginTop: 20,
          opacity: hideTitle ? 0 : 1,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          color: p.secondary,
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>35% read</span>
        <span>8 passages left</span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          marginTop: 12,
          background: p.border,
        }}
      >
        <div style={{ width: "35%", background: p.accent, height: "100%" }} />
      </div>
      <p style={{ fontSize: 23, lineHeight: "38px", marginTop: 42 }}>
        {sample}
      </p>
      <p style={{ fontSize: 23, lineHeight: "38px", opacity: 0.6 }}>
        Keep what matters. Come back to the rest.
      </p>
      <Card
        p={p}
        style={{ position: "absolute", left: 20, right: 20, bottom: 52 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>V Ask Votic</strong>
          <span style={{ color: p.secondary }}>More ⌃</span>
        </div>
        <div
          style={{
            opacity: listening,
            height: 76 * listening,
            translate: `0 ${(1 - listening) * MOTION.mode.distance}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
            overflow: "hidden",
          }}
        >
          <span>◂</span>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: p.accent,
              display: "grid",
              placeItems: "center",
            }}
          >
            <PlayGlyph progress={play} color="#FFFFFF" />
          </div>
          <span>▸</span>
        </div>
      </Card>
    </>
  );
}
function MotionScene({
  kind,
  dark: isDark,
  reducedMotion,
}: MotionProps & { kind: Kind }) {
  const p = isDark ? dark : light;
  const at = useTimeline(reducedMotion);
  const open = at(600, MOTION.document.open);
  const mode = at(700, MOTION.mode.duration) - at(2400, MOTION.mode.duration);
  const play =
    at(700, MOTION.playback.duration) - at(2300, MOTION.playback.duration);
  const saved = at(850, MOTION.saved.duration);
  const ring = at(500, MOTION.finish.ring);
  const checked = at(
    reducedMotion ? 500 : 500 + MOTION.finish.ring,
    MOTION.finish.short + MOTION.finish.long,
  );
  const totals = at(
    reducedMotion
      ? 500
      : 500 + MOTION.finish.ring + MOTION.finish.short + MOTION.finish.long,
    MOTION.finish.totals,
  );
  const actions = at(
    reducedMotion
      ? 500
      : 500 +
          MOTION.finish.ring +
          MOTION.finish.short +
          MOTION.finish.long +
          MOTION.finish.totals,
    MOTION.finish.actions,
  );
  const pop = at(800, MOTION.feedback.duration);
  return (
    <AbsoluteFill style={{ background: p.background }}>
      <div
        style={{
          width: 390,
          height: 844,
          scale: 2,
          transformOrigin: "top left",
          color: p.text,
          background: p.background,
          fontFamily: "Arial, sans-serif",
          position: "relative",
          padding: "40px 20px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {kind === "document" ? (
          <>
            <div style={{ opacity: 1 - open }}>
              <h2>Votic</h2>
              <h1 style={{ fontSize: 26 }}>Documents</h1>
              <Card
                p={p}
                style={{
                  position: "absolute",
                  left: 20,
                  right: 20,
                  top: 210,
                  height: 96,
                  boxSizing: "border-box",
                }}
              >
                <span
                  style={{
                    color: p.secondary,
                    fontSize: 13,
                    position: "absolute",
                    top: 58,
                  }}
                >
                  PDF · Not started
                </span>
              </Card>
            </div>
            <div
              style={{
                position: "absolute",
                left: 20 * (1 - open),
                top: 210 * (1 - open),
                width: 350 + 40 * open,
                height: 96 + 748 * open,
                borderRadius: 20 * (1 - open),
                border: `1px solid ${p.border}`,
                boxSizing: "border-box",
                background: p.background,
              }}
            />
            <div
              style={{
                opacity: Math.max(
                  0,
                  (open - MOTION.document.textFrom) /
                    (1 - MOTION.document.textFrom),
                ),
                position: "absolute",
                inset: "40px 20px",
              }}
            >
              <Reader p={p} listening={0} hideTitle />
            </div>
            <div
              style={{
                position: "absolute",
                left: 40 - 20 * open,
                top: 235 - 75 * open,
                fontSize: 19,
                lineHeight: "24px",
                fontWeight: 800,
              }}
            >
              {title}
            </div>
          </>
        ) : null}
        {kind === "mode" || kind === "playback" ? (
          <Reader
            p={p}
            listening={kind === "mode" ? mode : 1}
            play={kind === "playback" ? play : 0}
          />
        ) : null}
        {kind === "import" ? (
          <>
            <Reader p={p} listening={0} />
            <Card
              p={p}
              style={{
                position: "absolute",
                bottom: 140,
                left: 16,
                right: 16,
                borderColor: p.accent,
                padding: 12,
                display: "flex",
                gap: 12,
                alignItems: "center",
                opacity: saved,
                translate: `0 ${-8 * (1 - saved)}px`,
                scale: 0.94 + saved * 0.06,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: p.tint,
                  display: "grid",
                  placeItems: "center",
                  color: p.accent,
                }}
              >
                ✓
              </div>
              <div style={{ fontSize: 14 }}>
                <strong>Added to your library</strong>
                <div style={{ color: p.secondary, marginTop: 5 }}>{title}</div>
              </div>
            </Card>
          </>
        ) : null}
        {kind === "finish" ? (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,.45)",
              }}
            />
            <Card
              p={p}
              style={{
                position: "absolute",
                top: 175,
                left: 24,
                right: 24,
                padding: 24,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 88,
                  height: 88,
                  position: "relative",
                  margin: "0 auto",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 44,
                    border: `4px solid ${p.border}`,
                  }}
                />
                {Array.from({ length: 72 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 4.2,
                      height: 4,
                      borderRadius: 0.8,
                      background: p.accent,
                      rotate: `${i * 5}deg`,
                      left: 41.9 + 42 * Math.sin((i * Math.PI) / 36),
                      top: 42 - 42 * Math.cos((i * Math.PI) / 36),
                      opacity: i / 72 < 0.85 + ring * 0.15 ? 1 : 0,
                    }}
                  />
                ))}
                <div
                  style={{
                    position: "absolute",
                    inset: 16,
                    background: p.accent,
                    color: "white",
                    borderRadius: 30,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 32,
                  }}
                >
                  <span
                    style={{ opacity: checked, scale: 0.8 + checked * 0.2 }}
                  >
                    ✓
                  </span>
                </div>
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 13,
                  fontWeight: 700,
                  color: p.accent,
                }}
              >
                100% read
              </div>
              <div
                style={{
                  opacity: totals,
                  translate: `0 ${12 * (1 - totals)}px`,
                }}
              >
                <h1 style={{ fontSize: 26 }}>Nicely done.</h1>
                <div style={{ color: p.secondary }}>{title}</div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-around",
                    margin: "24px 0",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 21 }}>12 min</strong>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Time spent</div>
                  </div>
                  <div>
                    <strong style={{ fontSize: 21 }}>24</strong>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Passages</div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  opacity: actions,
                  translate: `0 ${8 * (1 - actions)}px`,
                }}
              >
                <div
                  style={{
                    borderRadius: 24,
                    padding: 14,
                    background: p.accent,
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  Summarize this document
                </div>
                <Card
                  p={p}
                  style={{ marginTop: 12, padding: 14, textAlign: "left" }}
                >
                  Ask a follow-up
                </Card>
                <Card
                  p={p}
                  style={{ marginTop: 12, padding: 14, textAlign: "left" }}
                >
                  Next up
                </Card>
              </div>
            </Card>
          </>
        ) : null}
        {kind === "bookmark" ? (
          <>
            <Reader p={p} listening={0} />
            <div
              style={{
                position: "absolute",
                right: 20,
                top: 52,
                scale: interpolate(pop, [0, 0.45, 1], [0.92, 1.08, 1]),
              }}
            >
              <Bookmark filled={pop > 0} color={p.accent} />
            </div>
            <Card
              p={p}
              style={{
                position: "absolute",
                bottom: 140,
                left: 16,
                right: 16,
                opacity: pop,
                color: p.accent,
                fontWeight: 700,
              }}
            >
              ✓ Passage saved
            </Card>
          </>
        ) : null}
        {kind === "note" ? (
          <>
            <h2>Votic</h2>
            <h1 style={{ fontSize: 26 }}>Notes</h1>
            <Card
              p={p}
              style={{
                marginTop: 80,
                scale: interpolate(pop, [0, 0.45, 1], [0.92, 1.08, 1]),
              }}
            >
              <div style={{ color: p.secondary, fontSize: 13 }}>
                Note · Today
              </div>
              <h3>Make room for the idea</h3>
              <p style={{ fontSize: 16, lineHeight: "25px" }}>
                Give the important things a little more space.
              </p>
            </Card>
            <Card
              p={p}
              style={{
                position: "absolute",
                bottom: 140,
                left: 16,
                right: 16,
                opacity: pop,
                color: p.accent,
                fontWeight: 700,
              }}
            >
              ✓ Note saved
            </Card>
          </>
        ) : null}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 20,
            right: 20,
            color: p.secondary,
            fontSize: 11,
            textAlign: "center",
          }}
        >
          Motion study · {labels[kind]}
          {reducedMotion ? " · Reduce motion" : ""}
        </div>
      </div>
    </AbsoluteFill>
  );
}
export const DocumentOpen = (p: MotionProps) => (
  <MotionScene {...p} kind="document" />
);
export const ReadListen = (p: MotionProps) => (
  <MotionScene {...p} kind="mode" />
);
export const PlayPause = (p: MotionProps) => (
  <MotionScene {...p} kind="playback" />
);
export const ImportSaved = (p: MotionProps) => (
  <MotionScene {...p} kind="import" />
);
export const FinishReveal = (p: MotionProps) => (
  <MotionScene {...p} kind="finish" />
);
export const BookmarkSaved = (p: MotionProps) => (
  <MotionScene {...p} kind="bookmark" />
);
export const NoteSaved = (p: MotionProps) => <MotionScene {...p} kind="note" />;
