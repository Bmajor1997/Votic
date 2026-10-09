import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import type { TextRevealFrame } from "./textReveal";

export function RevealingText({ frame, style }: { frame: TextRevealFrame; style?: StyleProp<TextStyle> }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [settle] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion || frame.highlightStart >= frame.visible.length) return;
    settle.setValue(0);
    const animation = Animated.timing(settle, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start();
    return () => {
      animation.stop();
      settle.stopAnimation();
    };
  }, [settle, frame.visible, frame.highlightStart, reduceMotion]);
  const requestedColor = StyleSheet.flatten(style)?.color;
  const color = typeof requestedColor === "string" ? requestedColor : theme.text;
  return (
    <View>
      {/* Reserve the final wrapping/height, without exposing a duplicate to screen readers. */}
      <Text
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[style, { color: "transparent" }]}
      >
        {frame.text}
      </Text>
      <Text
        selectable
        accessibilityLabel={frame.text}
        accessibilityLiveRegion="none"
        style={[style, StyleSheet.absoluteFill, { color }]}
      >
        {reduceMotion ? (
          frame.text
        ) : (
          <>
            {frame.visible.slice(0, frame.highlightStart)}
            <Animated.Text
              style={{
                color: settle.interpolate({
                  inputRange: [0, 1],
                  outputRange: [theme.accentText, color],
                }),
              }}
            >
              {frame.visible.slice(frame.highlightStart)}
            </Animated.Text>
          </>
        )}
      </Text>
    </View>
  );
}
