import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { mix, useVoticTheme } from "../theme/ThemeProvider";

const SWEEP_MS = 1300;
const PAUSE_MS = 350;
const FRAME_MS = 40;
/** How many characters on each side of the band's center are lit. */
const BAND = 3;

/**
 * A short status label ("Thinking") with a band of the accent color sweeping across it, left to right, then a
 * short pause. One light timer drives it, rather than an animation per letter.
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
  const [center, setCenter] = useState(-BAND);
  useEffect(() => {
    if (reduceMotion) return;
    const started = Date.now();
    const span = characters.length + BAND * 2;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - started) % (SWEEP_MS + PAUSE_MS);
      setCenter(elapsed > SWEEP_MS ? characters.length + BAND : -BAND + (elapsed / SWEEP_MS) * span);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [characters.length, reduceMotion]);
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      style={[style, { color: theme.mutedText }]}
    >
      {reduceMotion
        ? text
        : characters.map((character, index) => {
            const glow = Math.max(0, 1 - Math.abs(index - center) / BAND);
            return (
              <Text
                key={index}
                style={glow > 0 ? { color: mix(theme.mutedText, theme.accentText, glow) } : null}
              >
                {character}
              </Text>
            );
          })}
    </Text>
  );
}
