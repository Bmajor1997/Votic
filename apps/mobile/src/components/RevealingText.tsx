import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { mix, useVoticTheme } from "../theme/ThemeProvider";
import { ink_segments, type TextRevealFrame } from "./textReveal";

const HEX = /^#[0-9a-f]{6}$/i;
/**
 * Ink for words not written yet. On Android a fully transparent color (0) means "no color set", so the words
 * would inherit the normal text color and show; one step of alpha keeps them invisible but still laid out.
 */
export const UNWRITTEN_INK = "#00000001";

/**
 * The color of a glowing piece of the writing edge: the accent color near the edge, settling into the text color
 * behind it, with the very newest characters still fading in. Non-hex colors are shown plain.
 */
function edge_color(text: string, accent: string, position: number) {
  if (!HEX.test(text) || !HEX.test(accent)) return text;
  const glow = mix(text, accent, Math.min(1, position * 0.95));
  const alpha = position > 0.8 ? 1 - (position - 0.8) * 3 : 1;
  return `${glow}${Math.round(Math.max(0.35, alpha) * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

/**
 * Text being laid down from left to right: settled words, then a writing edge that glows in the accent color as
 * it moves, so the shimmer travels with the words being laid down. The rest of
 * the finished text is already there but invisible, so lines wrap exactly as they will at the end and nothing
 * jumps as words arrive. Screen readers get the whole text at once.
 */
export function RevealingText({
  frame,
  style,
  singleLine = false,
}: {
  frame: TextRevealFrame;
  style?: StyleProp<TextStyle>;
  /**
   * Keep to one line while the words appear, showing the newest ones, instead of reserving the finished
   * text's height. The box can then grow once the text is all there.
   */
  singleLine?: boolean;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const requestedColor = StyleSheet.flatten(style)?.color;
  const color = typeof requestedColor === "string" ? requestedColor : theme.text;
  const done = reduceMotion || frame.complete;
  const inked = done ? frame.text : frame.visible.slice(0, frame.highlightStart);
  const edge = done ? [] : ink_segments(frame);
  const rest = done ? "" : frame.text.slice(frame.visible.length);
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
        <Text key={index} style={{ color: edge_color(color, theme.accentText, segment.position) }}>
          {segment.text}
        </Text>
      ))}
      {singleLine || !rest ? null : <Text style={{ color: UNWRITTEN_INK }}>{rest}</Text>}
    </Text>
  );
}
