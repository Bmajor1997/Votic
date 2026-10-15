import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { ink_segments, type TextRevealFrame } from "./textReveal";

/** `#RRGGBB` at an opacity, for the fading edge; other color formats are shown solid. */
function faded(color: string, alpha: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  return `${color}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

/**
 * Text being laid down from left to right: inked words, then a short edge that is still fading in. The rest of
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
        <Text key={index} style={{ color: faded(color, segment.alpha) }}>
          {segment.text}
        </Text>
      ))}
      {singleLine || !rest ? null : <Text style={{ color: "transparent" }}>{rest}</Text>}
    </Text>
  );
}
