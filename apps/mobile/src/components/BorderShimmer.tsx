import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { mix, useVoticTheme } from "../theme/ThemeProvider";

const LAP_MS = 3200;
// Long enough to cross any composer from its center, whatever its width.
const REACH = 1400;
// Soft white light: a bright core with two fainter halos either side of it.
const LAYERS = [
  { thickness: 44, opacity: 0.22 },
  { thickness: 22, opacity: 0.45 },
  { thickness: 8, opacity: 0.95 },
];

/**
 * A white glint that travels around a rounded outline. Place it as the first child of the bordered view: it draws
 * over that view's own border, then covers the inside again with `fill`, so only the outline catches the light and
 * the view's content stays on top. Hidden from screen readers; still with Reduce Motion.
 */
export function BorderShimmer({
  radius,
  fill,
  borderWidth = 1,
}: {
  radius: number;
  fill: string;
  borderWidth?: number;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [turn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const lap = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: LAP_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    lap.start();
    return () => lap.stop();
  }, [reduceMotion, turn]);
  if (reduceMotion) return null;
  const halo = mix(theme.accent, "#FFFFFF", 0.55);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View
      testID="border-shimmer"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, s.ring, { margin: -borderWidth, borderRadius: radius }]}
    >
      <Animated.View style={[s.beam, { transform: [{ rotate }] }]}>
        <View style={s.half}>
          {LAYERS.map((layer, index) => (
            <View
              key={index}
              style={[
                s.layer,
                {
                  height: layer.thickness,
                  marginTop: -layer.thickness / 2,
                  opacity: layer.opacity,
                  backgroundColor: index === LAYERS.length - 1 ? "#FFFFFF" : halo,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
      <View
        style={[
          StyleSheet.absoluteFill,
          { margin: borderWidth, borderRadius: Math.max(0, radius - borderWidth), backgroundColor: fill },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  ring: { overflow: "hidden" },
  beam: {
    position: "absolute",
    width: REACH * 2,
    height: 1,
    left: "50%",
    top: "50%",
    marginLeft: -REACH,
  },
  // Only the half from the center outwards carries the light, so one glint travels around, not two.
  half: { position: "absolute", left: REACH, width: REACH, top: 0 },
  layer: { position: "absolute", left: 0, right: 0, top: 0 },
});
