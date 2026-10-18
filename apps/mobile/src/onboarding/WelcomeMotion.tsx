import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { VoticLogo } from "../components/VoticLogo";
import { useVoticTheme } from "../theme/ThemeProvider";

const BRAND_BLUE = "#2563EB";
/** Faint, shrinking circles stack into a soft glow, since React Native has no blur. */
const GLOW_LAYERS = [1, 0.86, 0.72, 0.6];

/**
 * The Votic V on a white tile with a soft blue glow, used on Welcome and the account screens. It is the
 * same mark as the logo, so its wings are the logo's blue. Decorative: the logo above already names Votic.
 */
export function BrandMark({ size = 88 }: { size?: number }) {
  const { theme } = useVoticTheme();
  const halo = size * 1.8;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: halo, height: halo, alignItems: "center", justifyContent: "center" }}
    >
      {GLOW_LAYERS.map((layer) => (
        <View
          key={layer}
          style={[
            s.glow,
            {
              width: halo * layer,
              height: halo * layer,
              borderRadius: halo,
              backgroundColor: BRAND_BLUE,
              opacity: theme.isDark ? 0.12 : 0.07,
            },
          ]}
        />
      ))}
      <View
        style={[
          s.tile,
          theme.elevation,
          {
            width: size,
            height: size,
            borderRadius: size * 0.3,
            backgroundColor: theme.isDark ? theme.surfaceMuted : "#FFFFFF",
          },
        ]}
      >
        <VoticLogo markOnly markSize={Math.round(size * 0.6)} />
      </View>
    </View>
  );
}

/**
 * The V's one movement: when someone taps Sign in it crouches, hops, and flies up off the top of the
 * screen, then Sign in opens. With Less motion it doesn't move and Sign in opens straight away. Coming
 * back to the screen puts the V back in place.
 */
export function useHopAway() {
  const { reduceMotion } = useAccessibilityPreferences();
  const [progress] = useState(() => new Animated.Value(0));
  const hopping = useRef(false);
  useFocusEffect(
    useCallback(() => {
      hopping.current = false;
      progress.setValue(0);
    }, [progress]),
  );
  const hop = useCallback(
    (then: () => void) => {
      if (hopping.current) return;
      if (reduceMotion) {
        then();
        return;
      }
      hopping.current = true;
      Animated.sequence([
        // Crouch,
        Animated.timing(progress, {
          toValue: 1,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // hop up a little,
        Animated.timing(progress, {
          toValue: 2,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // then take off and leave through the top of the screen.
        Animated.timing(progress, {
          toValue: 3,
          duration: 380,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) then();
        else hopping.current = false;
      });
    },
    [progress, reduceMotion],
  );
  const style = {
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0, 8, -46, -1100] }) },
      { scaleX: progress.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [1, 1.1, 0.96, 0.9] }) },
      { scaleY: progress.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [1, 0.86, 1.06, 1.12] }) },
      { rotate: progress.interpolate({ inputRange: [0, 2, 3], outputRange: ["0deg", "-4deg", "-9deg"] }) },
    ],
  };
  return { hop, style };
}

const s = StyleSheet.create({
  glow: { position: "absolute" },
  tile: { alignItems: "center", justifyContent: "center" },
});
