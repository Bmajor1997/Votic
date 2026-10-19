import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** Votic's default blue, lifted for a navy background, and the type the app uses. */
const WING = "#5B8DEF";
const INK = "#F5F8FF";
const MUTED = "#BCD0F4";
const FONT = "'Plus Jakarta Sans', 'Inter', 'Helvetica Neue', Arial, sans-serif";

const bg: React.CSSProperties = {
  background: "radial-gradient(ellipse at 50% 35%, #203E91 0%, #0B1738 43%, #060B1D 100%)",
  color: INK,
  fontFamily: FONT,
};
const center: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function Glow({ size = 420, strength = 1 }: { size?: number; strength?: number }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "radial-gradient(circle, #4A8DFF88, #744DFF33 44%, transparent 73%)",
        opacity: strength,
        transform: `scale(${1 + Math.sin(frame / 18) * 0.06})`,
        filter: "blur(20px)",
      }}
    />
  );
}

/** One piece of the real Votic mark: the PNGs are shapes, so wings are filled blue and the stroke white. */
function Piece({ file, color, style }: { file: string; color: string; style: React.CSSProperties }) {
  const mask = `url(${staticFile(file)}) center / contain no-repeat`;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: color,
        WebkitMask: mask,
        mask,
        ...style,
      }}
    />
  );
}

/**
 * The Votic V assembles, the reverse of the sign-in animation: the stroke rises into place, then each wing
 * flies in from the right, top first, then the wordmark appears.
 */
export function VoticIntro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrive = (start: number) =>
    interpolate(frame, [start, start + 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const stroke = arrive(4);
  const wings = [arrive(16), arrive(22), arrive(28)];
  const settle = spring({ frame: frame - 44, fps, config: { damping: 12, stiffness: 120 } });
  const word = interpolate(frame, [52, 70], [0, 1], clamp);
  const subtitle = interpolate(frame, [66, 86], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ ...bg, ...center, flexDirection: "column" }}>
      <Glow size={760} strength={interpolate(frame, [0, 40], [0.3, 1], clamp)} />
      <div style={{ position: "relative", width: 460, height: 460, transform: `scale(${1 + settle * 0.04 - 0.04})` }}>
        <Piece
          file="votic-mark-stroke.png"
          color={INK}
          style={{ opacity: stroke, transform: `translate(${(1 - stroke) * -60}px, ${(1 - stroke) * 260}px)` }}
        />
        {wings.map((t, index) => (
          <Piece
            key={index}
            file={`votic-wing-${index + 1}.png`}
            color={WING}
            style={{ opacity: t, transform: `translateX(${(1 - t) * 520}px) rotate(${(1 - t) * -8}deg)` }}
          />
        ))}
      </div>
      <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -4, marginTop: 40, opacity: word, transform: `translateY(${(1 - word) * 24}px)` }}>
        Votic
      </div>
      <div style={{ fontSize: 42, marginTop: 22, color: MUTED, opacity: subtitle }}>Read. Listen. Understand.</div>
    </AbsoluteFill>
  );
}

const icon = { width: 170, height: 170, fill: "none", stroke: "#DDEBFF", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" {...icon}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);
const HeadphonesIcon = () => (
  <svg viewBox="0 0 24 24" {...icon}>
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    <rect x="3" y="14" width="4" height="6" rx="1.5" />
    <rect x="17" y="14" width="4" height="6" rx="1.5" />
  </svg>
);
const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" {...icon}>
    <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
    <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </svg>
);

const scenes = [
  { Icon: DocumentIcon, title: "Your documents", detail: "PDFs, books, articles, and scans in one place" },
  { Icon: HeadphonesIcon, title: "Listen naturally", detail: "Hear every page, with the words highlighted" },
  { Icon: SparklesIcon, title: "Ask Votic", detail: "Answers that come from your own documents" },
];

/**
 * A silent loop for the paywall: documents, listening, answers. It never shows prices or purchase buttons;
 * those stay in the app, worded from the store.
 */
export function VoticPremium() {
  const frame = useCurrentFrame();
  const stage = Math.min(2, Math.floor(frame / 70));
  const progress = frame % 70;
  const reveal = interpolate(progress, [0, 16, 55, 69], [0, 1, 1, stage === 2 ? 1 : 0], clamp);
  const { Icon, title, detail } = scenes[stage];
  return (
    <AbsoluteFill style={{ ...bg, ...center, flexDirection: "column", padding: 80, textAlign: "center" }}>
      <Glow size={850} />
      <div style={{ fontSize: 40, color: "#A8C5FF", fontWeight: 700, letterSpacing: 8, marginBottom: 90 }}>VOTIC PREMIUM</div>
      <div style={{ opacity: reveal, transform: `translateY(${(1 - reveal) * 45}px)`, ...center, flexDirection: "column" }}>
        <div
          style={{
            width: 320,
            height: 360,
            borderRadius: 56,
            border: `3px solid ${WING}`,
            background: "#152B5C",
            ...center,
            boxShadow: "0 0 110px #3565FF55",
          }}
        >
          <Icon />
        </div>
        <div style={{ fontSize: 79, fontWeight: 800, marginTop: 80 }}>{title}</div>
        <div style={{ fontSize: 39, color: "#C4D3F1", marginTop: 30, maxWidth: 820 }}>{detail}</div>
      </div>
      <div style={{ position: "absolute", bottom: 160, ...center, gap: 18 }}>
        {scenes.map((_, index) => (
          <div key={index} style={{ width: index === stage ? 44 : 14, height: 14, borderRadius: 7, background: index === stage ? WING : "#3B5488" }} />
        ))}
      </div>
    </AbsoluteFill>
  );
}
