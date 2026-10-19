import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const bg: React.CSSProperties = { background: "radial-gradient(ellipse at 50% 35%, #203E91 0%, #0B1738 43%, #060B1D 100%)", color: "#F5F8FF", fontFamily: "Arial, sans-serif" };
const center: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center" };
function Glow({ size = 420 }: { size?: number }) {
  const frame = useCurrentFrame();
  return <div style={{ position: "absolute", width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle, #4A8DFF88, #744DFF33 44%, transparent 73%)", transform: `scale(${1 + Math.sin(frame / 18) * 0.06})`, filter: "blur(20px)" }} />;
}
export function VaticIntro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 16, stiffness: 65 } });
  const subtitle = interpolate(frame, [35, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ ...bg, ...center, flexDirection: "column" }}>
    <Glow size={700} />
    <div style={{ fontSize: 270, fontWeight: 900, letterSpacing: -28, color: "#DDEBFF", transform: `translateY(${(1-reveal)*90}px) scale(${0.7+0.3*reveal})`, opacity: reveal }}>V</div>
    <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -4, opacity: reveal }}>Vatic</div>
    <div style={{ fontSize: 39, marginTop: 25, color: "#BCD0F4", opacity: subtitle }}>Read. Listen. Understand.</div>
  </AbsoluteFill>;
}
const scenes = [
  { icon: "▤", title: "Your documents", detail: "All your reading, in one place" },
  { icon: "♫", title: "Listen naturally", detail: "Turn pages into spoken words" },
  { icon: "✦", title: "Ask Vatic", detail: "Find answers in your documents" },
];
export function VaticPaywall() {
  const frame = useCurrentFrame();
  const stage = Math.min(2, Math.floor(frame / 70));
  const progress = frame % 70;
  const reveal = interpolate(progress, [0, 16, 55, 69], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const item = scenes[stage];
  return <AbsoluteFill style={{ ...bg, ...center, flexDirection: "column", padding: 80, textAlign: "center" }}>
    <Glow size={850} />
    <div style={{ fontSize: 40, color: "#A8C5FF", fontWeight: 700, letterSpacing: 8, marginBottom: 90 }}>VATIC PLUS & PRO</div>
    <div style={{ opacity: reveal, transform: `translateY(${(1-reveal)*45}px)`, ...center, flexDirection: "column" }}>
      <div style={{ width: 320, height: 360, borderRadius: 56, border: "3px solid #7198F5", background: "#152B5C", ...center, fontSize: 165, boxShadow: "0 0 110px #3565FF55" }}>{item.icon}</div>
      <div style={{ fontSize: 79, fontWeight: 800, marginTop: 80 }}>{item.title}</div>
      <div style={{ fontSize: 39, color: "#C4D3F1", marginTop: 30 }}>{item.detail}</div>
    </div>
    <div style={{ position: "absolute", bottom: 125, fontSize: 32, color: "#9CB8F5" }}>More room to read, listen, and understand.</div>
  </AbsoluteFill>;
}
