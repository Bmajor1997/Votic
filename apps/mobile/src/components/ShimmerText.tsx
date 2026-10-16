import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { ai_shimmer_colors } from "./aiShimmerColors";
import { mix, useVoticTheme } from "../theme/ThemeProvider";

const SWEEP_MS = 1300;
const FRAME_MS = 40;
/** How many characters on each side of the band's center are lit. */
const BAND = 3;

/**
 * A short status label ("Reading", "Writing") with a band of light sweeping across blue letters, left to right:
 * the letters it passes turn violet and brighten towards white, like the light in the writing glow. Explicit letter
 * colors keep the sweep visible on Android too. One light timer drives the whole label.
 */
export function ShimmerText({
  text,
  accessibilityLabel = text,
  style,
}: {
  text: string;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const characters = Array.from(text);
  const [center, setCenter] = useState(0);
  const { blue, violet } = ai_shimmer_colors(theme.mode);
  // Blue and violet are close in brightness, so the band also lightens the letters to be clearly seen.
  const light = mix(violet, theme.mode === "dark" ? "#FFFFFF" : theme.background, 0.6);
  useEffect(() => {
    if (reduceMotion) return;
    const started = Date.now();
    const span = characters.length + BAND * 2;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - started) % SWEEP_MS;
      setCenter((((elapsed / SWEEP_MS) * span + BAND) % span) - BAND);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [text, characters.length, reduceMotion]);
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      style={[style, { color: reduceMotion ? theme.aiStatusText : blue }]}
    >
      {reduceMotion
        ? text
        : characters.map((character, index) => {
            const glow = Math.max(0, 1 - Math.abs(index - center) / BAND);
            return (
              <Text key={index} style={{ color: shimmer_color(blue, violet, light, glow) }}>
                {character}
              </Text>
            );
          })}
    </Text>
  );
}

/** A letter's color as the band passes: blue at rest, violet and much lighter at the band's center. */
export function shimmer_color(blue: string, violet: string, light: string, glow: number) {
  return glow > 0 ? mix(mix(blue, violet, glow), light, glow * 0.7) : blue;
}
