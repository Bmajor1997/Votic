import {
  AbsoluteFill,
} from "remotion";
import { RobotWordmark } from "./RobotWordmark";

type Props = {
  dark: boolean;
  reducedMotion: boolean;
  returningSession: boolean;
};
/** Study of the existing logo as one rigid unit, at the native header's logical size and position. */
export function HomeLogoEntrance({
  dark,
  reducedMotion,
  returningSession,
}: Props) {
  const ink = dark ? "#FAFAF9" : "#292D32";
  const surface = dark ? "#32373D" : "#FFFFFF";
  const accent = dark ? "#87A7F4" : "#2563EB";
  const border = dark ? "#4B5158" : "#E5E7EB";
  return (
    <AbsoluteFill
      style={{
        backgroundColor: dark ? "#292D32" : "#FFFFFF",
        color: ink,
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "47px 20px 0",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 64,
            paddingBottom: 4,
            borderBottom: `1px solid ${border}`,
          }}
        >
          <RobotWordmark dark={dark} settled={reducedMotion || returningSession} />
          <div style={{ width: 44, height: 44 }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 26 }}>Continue</h2>
        <div
          style={{
            border: `1px solid ${border}`,
            backgroundColor: surface,
            borderRadius: 24,
            padding: 24,
            display: "grid",
            gap: 18,
          }}
        >
          <span style={{ color: accent, fontSize: 12, fontWeight: 800 }}>
            YOUR NEXT CHAPTER
          </span>
          <strong style={{ fontSize: 20 }}>A little space to think</strong>
          <span style={{ color: dark ? "#D1D5DB" : "#626262", fontSize: 14 }}>
            Pick up where you left off
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                flex: 1,
                padding: "16px 6px",
                textAlign: "center",
                borderRadius: 12,
                backgroundColor: "#2563EB",
                color: "white",
                fontWeight: 800,
              }}
            >
              Continue Listening
            </div>
            <div
              style={{
                flex: 1,
                padding: "16px 6px",
                textAlign: "center",
                borderRadius: 12,
                border: `1px solid ${border}`,
                fontWeight: 700,
              }}
            >
              Continue Reading
            </div>
          </div>
        </div>
        <h3 style={{ margin: 0 }}>Recent documents</h3>
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 20 }}>
          Your documents stay in place while the logo arrives.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 34,
          left: 20,
          right: 20,
          paddingTop: 18,
          display: "flex",
          justifyContent: "space-around",
          borderTop: `1px solid ${border}`,
          fontSize: 13,
        }}
      >
        <strong style={{ color: accent }}>Home</strong>
        <span>Documents</span>
        <span>Notes</span>
        <span>Settings</span>
      </div>
    </AbsoluteFill>
  );
}
