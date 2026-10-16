import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { mix, useVoticTheme } from "../theme/ThemeProvider";
import { ai_shimmer_colors } from "./aiShimmerColors";
import { INK_TAIL, ink_segments, type TextRevealFrame } from "./textReveal";

const HEX = /^#[0-9a-f]{6}$/i;
/**
 * Ink for words not written yet. On Android a fully transparent color (0) means "no color set", so the words
 * would inherit the normal text color and show; one step of alpha keeps them invisible but still laid out.
 */
export const UNWRITTEN_INK = "#00000001";

/**
 * The color of one letter at the writing edge, `position` running from 0 (settled) to 1 (just written).
 * Letters glow soft violet and settle into the text color behind the edge. The newest few are still forming:
 * they start pale and see-through and condense into solid ink. A band of light runs through the glow towards the
 * edge, so the shimmer looks like it is pouring into the letters being made. Non-hex colors are shown plain.
 */
export function edge_color(text: string, violet: string, light: string, position: number, band: number) {
  if (!HEX.test(text) || !HEX.test(violet) || !HEX.test(light)) return text;
  const glow = mix(text, violet, Math.min(1, position));
  const shine = Math.max(0, 1 - Math.abs(position - band) / 0.18) * 0.55;
  const forming = position > FORMING ? (position - FORMING) / (1 - FORMING) : 0;
  const color = mix(glow, light, Math.min(1, shine + forming * 0.6));
  if (!forming) return color;
  // Never fully transparent: on Android an alpha of 0 means "no color set" and would show plain text.
  const alpha = Math.round((1 - forming * 0.8) * 255);
  return `${color}${alpha.toString(16).padStart(2, "0")}`;
}
/** The newest share of the glowing edge whose letters are still forming. */
const FORMING = 0.8;
/** How many letters the band of light travels before it starts again at the back of the glow. */
const BAND_SPAN = 14;

/**
 * Text being written from left to right: settled words, then a writing edge where letters form out of a soft
 * violet light and settle into ink. Only the rest of the word being written is held invisibly in place, so a word
 * never jumps to the next line halfway through, and the text grows line by line as it is written, which keeps
 * the newest words in view as the conversation scrolls with them. Screen readers get the whole text at once.
 */
export function RevealingText({
  frame,
  style,
  singleLine = false,
}: {
  frame: TextRevealFrame;
  style?: StyleProp<TextStyle>;
  /** Keep to one line while the words appear, showing the newest ones. */
  singleLine?: boolean;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const requestedColor = StyleSheet.flatten(style)?.color;
  const color = typeof requestedColor === "string" ? requestedColor : theme.text;
  const done = reduceMotion || frame.complete;
  const inked = done ? frame.text : frame.visible.slice(0, frame.highlightStart);
  const edge = done ? [] : ink_segments(frame, INK_TAIL);
  const rest = done ? "" : (frame.text.slice(frame.visible.length).match(/^\S*/)?.[0] ?? "");
  const { violet } = ai_shimmer_colors(theme.mode);
  const light = mix(violet, theme.mode === "dark" ? "#FFFFFF" : theme.background, 0.6);
  // The band moves on with every few letters written, from the settled side towards the edge.
  const band = (Array.from(frame.visible).length % BAND_SPAN) / BAND_SPAN;
  return (
    <Text
      selectable
      accessibilityLabel={frame.text}
      accessibilityLiveRegion="none"
      {...(singleLine ? { numberOfLines: 1, ellipsizeMode: "head" as const } : null)}
      style={[style, { color }]}
    >
      {inked}
      {edge.map((segment, index) => (
        <Text key={index} style={{ color: edge_color(color, violet, light, segment.position, band) }}>
          {segment.text}
        </Text>
      ))}
      {singleLine || !rest ? null : <Text style={{ color: UNWRITTEN_INK }}>{rest}</Text>}
    </Text>
  );
}
