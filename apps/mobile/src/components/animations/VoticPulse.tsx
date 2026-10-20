import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../../theme/ThemeProvider";

/**
 * A soft pulse for "Votic is working" moments (speaking, thinking). It's decorative: the text beside it says
 * what's happening, so screen readers skip it. With Less motion, from Votic or the phone, it holds still.
 */
export function VoticPulse({ active, color, size = 28 }: { active: boolean; color?: string; size?: number }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    scale.stopAnimation();
    opacity.stopAnimation();
    scale.setValue(1);
    opacity.setValue(active ? 0.9 : 0.6);
    if (!active || reduceMotion) return;
    const beat = (value: Animated.Value, to: number, from: number) =>
      Animated.sequence([
        Animated.timing(value, {
          toValue: to,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(value, {
          toValue: from,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]);
    const animation = Animated.loop(Animated.parallel([beat(scale, 1.25, 1), beat(opacity, 1, 0.6)]));
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, scale, opacity]);

  const fill = color ?? theme.accent;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="votic-pulse"
      style={[s.frame, { width: size, height: size }]}
    >
      <Animated.View
        style={[
          s.dot,
          {
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: size,
            backgroundColor: fill,
            shadowColor: fill,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center" },
  dot: { shadowOpacity: 0.35, shadowRadius: 8, elevation: 3 },
});
