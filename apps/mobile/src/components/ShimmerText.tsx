import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { mix, useVoticTheme } from "../theme/ThemeProvider";

const SWEEP_MS = 1300;
const FRAME_MS = 40;
/** How many characters on each side of the band's center are lit. */
const BAND = 3;

/**
 * A short status label ("Thinking") with a violet band sweeping across blue letters, left to right.
 * Explicit letter colors keep the sweep visible on Android too. One light timer drives the whole label.
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
  const blue = theme.isDark ? "#60A5FA" : "#2563EB";
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
              <Text key={index} style={{ color: mix(blue, "#A78BFA", glow) }}>
                {character}
              </Text>
            );
          })}
    </Text>
  );
}
