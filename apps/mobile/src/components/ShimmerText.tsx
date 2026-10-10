import { useEffect, useState } from "react";
import { Animated, Easing, Text, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";

/** One sweep drives short status labels; no masks, extra native modules, or layout animation. */
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
  const [sweep] = useState(() => new Animated.Value(-3));
  const characters = Array.from(text);
  useEffect(() => {
    if (reduceMotion) return;
    sweep.setValue(-3);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: characters.length + 3,
          duration: 1700,
          easing: Easing.linear,
          useNativeDriver: false,
          isInteraction: false,
        }),
        Animated.delay(450),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      sweep.stopAnimation();
    };
  }, [sweep, characters.length, reduceMotion]);
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      style={[style, { color: theme.mutedText }]}
    >
      {reduceMotion
        ? text
        : characters.map((character, index) => (
            <Animated.Text
              key={index}
              style={{
                color: sweep.interpolate({
                  inputRange: [index - 3, index, index + 3],
                  outputRange: [theme.mutedText, theme.text, theme.mutedText],
                  extrapolate: "clamp",
                }),
              }}
            >
              {character}
            </Animated.Text>
          ))}
    </Text>
  );
}
