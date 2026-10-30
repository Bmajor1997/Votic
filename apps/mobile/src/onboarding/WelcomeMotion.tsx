import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";

const BRAND_BLUE = "#2563EB";
/** Faint, shrinking circles stack into a soft glow, since React Native has no blur. */
const GLOW_LAYERS = [1, 0.84, 0.68];

/** The V in four pieces on one canvas, so each piece can move on its own and still line up exactly. */
const STROKE = require("../../assets/votic-mark-stroke.png");
const WINGS: ImageSourcePropType[] = [
  require("../../assets/votic-wing-1.png"),
  require("../../assets/votic-wing-2.png"),
  require("../../assets/votic-wing-3.png"),
];

type Flight = {
  wings: Animated.Value[];
  stroke: Animated.Value;
  glow: Animated.Value;
};

/**
 * The Votic V on its own, without an app-icon square, over a soft blue glow. Its wings are the logo's
 * blue. The paywall can pulse the wings once while keeping the mark assembled. Given a flight (see
 * useMarkFlight), its pieces can fly away. Decorative: the logo already names Votic for screen readers.
 */
export function BrandMark({
  size = 88,
  flight,
  pulseWings = false,
}: {
  size?: number;
  flight?: Flight;
  /** One gentle brightness pulse; the full V stays assembled. */
  pulseWings?: boolean;
}) {
  const { theme } = useVoticTheme();
  const wingOpacity = useWingBrightnessPulse(pulseWings && !flight);
  const halo = size * 1.8;
  const piece = (source: ImageSourcePropType, tint: string | undefined, motion?: object) => (
    <Animated.View style={[StyleSheet.absoluteFill, motion]}>
      <Image source={source} resizeMode="contain" tintColor={tint} style={{ width: size, height: size }} />
    </Animated.View>
  );
  const wingMotion = (value: Animated.Value | undefined) =>
    value && {
      transform: [
        { translateX: value.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, -7, 620] }) },
        { translateY: value.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0, -36] }) },
        { rotate: value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-8deg"] }) },
      ],
    };
  const strokeMotion = flight && {
    transform: [
      { translateX: flight.stroke.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0, -280] }) },
      { translateY: flight.stroke.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 6, -1100] }) },
      { rotate: flight.stroke.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-24deg"] }) },
    ],
  };
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: halo, height: halo, alignItems: "center", justifyContent: "center" }}
    >
      {GLOW_LAYERS.map((layer) => (
        <Animated.View
          key={layer}
          style={[
            s.glow,
            {
              width: halo * layer,
              height: halo * layer,
              borderRadius: halo,
              backgroundColor: BRAND_BLUE,
              opacity: flight
                ? flight.glow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [theme.isDark ? 0.12 : 0.07, 0],
                  })
                : theme.isDark
                  ? 0.12
                  : 0.07,
            },
          ]}
        />
      ))}
      <View style={{ width: size, height: size }}>
        {piece(STROKE, theme.isDark ? "#FFFFFF" : undefined, strokeMotion)}
        {WINGS.map((wing, index) => (
          <View key={index} style={StyleSheet.absoluteFill}>
            {piece(wing, theme.logoWing, {
              ...wingMotion(flight?.wings[index]),
              opacity: wingOpacity,
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Once per mounted mark, with no movement, loops, or replay when preferences change. */
function useWingBrightnessPulse(active: boolean) {
  const { reduceMotion, motionReady } = useAccessibilityPreferences();
  const [opacity] = useState(() => new Animated.Value(1));
  const played = useRef(false);
  useEffect(() => {
    opacity.setValue(1);
    if (!active || !motionReady || reduceMotion || played.current) return;
    played.current = true;
    const animation = Animated.sequence([
      Animated.delay(180),
      Animated.timing(opacity, {
        toValue: 0.68,
        duration: 240,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      opacity.setValue(1);
    };
  }, [active, motionReady, reduceMotion, opacity]);
  return opacity;
}

/**
 * The welcome transition: when someone taps Sign in, the top wing flies off to the right, then the middle
 * wing, then the bottom one, and the left stroke flies up and away. Then Sign in opens. With Less motion
 * nothing moves and Sign in opens straight away. Coming back to the screen puts the V together again.
 */
export function useMarkFlight() {
  const { reduceMotion } = useAccessibilityPreferences();
  const [flight] = useState<Flight>(() => ({
    wings: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    stroke: new Animated.Value(0),
    glow: new Animated.Value(0),
  }));
  const flying = useRef(false);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const generation = useRef(0);
  const cancel = useCallback(() => {
    generation.current += 1;
    animation.current?.stop();
    animation.current = null;
    flying.current = false;
  }, []);
  useFocusEffect(
    useCallback(() => {
      cancel();
      flying.current = false;
      [...flight.wings, flight.stroke, flight.glow].forEach((value) => value.setValue(0));
      return cancel;
    }, [cancel, flight]),
  );
  const fly = useCallback(
    (then: () => void) => {
      if (flying.current) return;
      const token = ++generation.current;
      if (reduceMotion) {
        then();
        return;
      }
      flying.current = true;
      // Each piece nudges back a few points before it takes off (see the interpolations), then speeds away.
      const takeOff = (value: Animated.Value, duration: number) =>
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        });
      animation.current = Animated.parallel([
        Animated.stagger(
          130,
          flight.wings.map((wing) => takeOff(wing, 460)),
        ),
        Animated.sequence([Animated.delay(380), takeOff(flight.stroke, 520)]),
        Animated.timing(flight.glow, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]);
      animation.current.start(({ finished }) => {
        if (token !== generation.current) return;
        if (finished) then();
        else flying.current = false;
      });
    },
    [flight, reduceMotion],
  );
  return { fly, flight, cancel };
}

const s = StyleSheet.create({
  glow: { position: "absolute" },
});
