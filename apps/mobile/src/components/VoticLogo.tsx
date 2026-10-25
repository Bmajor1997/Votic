import { useEffect, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { VoticWordmark } from "./VoticWordmark";

export function VoticLogo({
  compact = false,
  markOnly = false,
  progress,
  animate = true,
}: {
  compact?: boolean;
  markOnly?: boolean;
  progress?: number;
  /** A whole-logo entrance owns its motion, so the wings stay still within it. */
  animate?: boolean;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const size = compact ? 24 : 34;
  const wing1 = useState(() => new Animated.Value(1))[0];
  const wing2 = useState(() => new Animated.Value(1))[0];
  const wing3 = useState(() => new Animated.Value(1))[0];

  const wordmark = !markOnly && progress === undefined;
  useEffect(() => {
    if (wordmark || progress !== undefined || reduceMotion || !animate) {
      [wing1, wing2, wing3].forEach((value) => value.setValue(1));
      return;
    }
    const pulse = (value: Animated.Value) =>
      Animated.sequence([
        Animated.timing(value, { toValue: 1.12, duration: 110, useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]);
    const animation = Animated.sequence([
      Animated.delay(180),
      pulse(wing1),
      Animated.delay(45),
      pulse(wing2),
      Animated.delay(45),
      pulse(wing3),
    ]);
    animation.start();
    return () => animation.stop();
  }, [wordmark, progress, reduceMotion, animate, wing1, wing2, wing3]);

  const wing = (value: Animated.Value, top: number, height: number, wingIndex: number) => {
    const fill = progress === undefined ? 1 : Math.max(0, Math.min(1, progress * 3 - wingIndex));
    const inset = progress === undefined ? 0 : size * 0.42;
    return (
      <View
        pointerEvents="none"
        style={[
          s.wingClip,
          { left: inset, width: (size - inset) * fill, height: size * height, top: size * top },
        ]}
      >
        <Animated.Image
          source={require("../../assets/votic-wings-mask.png")}
          resizeMode="contain"
          tintColor={theme.logoWing}
          style={{
            position: "absolute",
            left: -inset,
            top: -size * top,
            width: size,
            height: size,
            transform: [{ scale: value }],
          }}
        />
      </View>
    );
  };

  // The full logo is the wordmark built from separate V and letter layers; the mark alone keeps its
  // reading-progress wings (Reader and Ask Votic).
  if (wordmark) return <VoticWordmark compact={compact} pulse={animate && !reduceMotion} />;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Votic logo" style={s.row}>
      <View style={{ width: size, height: size, marginTop: 1 }}>
        <Image
          source={require("../../assets/votic-mark.png")}
          resizeMode="contain"
          tintColor={theme.isDark ? "#FFF" : undefined}
          style={{ width: size, height: size }}
        />
        {progress === undefined ? null : (
          <Image
            source={require("../../assets/votic-wings-mask.png")}
            resizeMode="contain"
            tintColor={theme.surface}
            style={{ position: "absolute", width: size, height: size }}
          />
        )}
        {wing(wing1, 0, 0.34, 0)}
        {wing(wing2, 0.31, 0.34, 1)}
        {wing(wing3, 0.62, 0.38, 2)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  wingClip: { position: "absolute", overflow: "hidden" },
});
