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
 * blue. Given a flight (see useMarkFlight), its pieces can fly away; with `arrive` (the paywall) they fly in
 * and assemble once. `pulseWings` brightens the assembled wings once. Decorative: the logo already names
 * Votic for screen readers.
 */
export function BrandMark({
  size = 88,
  flight: departure,
  arrive = false,
  pulseWings = false,
}: {
  size?: number;
  flight?: Flight;
  /** The sign-in flight in reverse: the stroke flies in, then each wing settles into it. Plays once. */
  arrive?: boolean;
  /** One gentle brightness pulse; the full V stays assembled. */
  pulseWings?: boolean;
}) {
  const { theme } = useVoticTheme();
  const arrival = useMarkArrival(arrive && !departure);
  const flight = departure ?? (arrive ? arrival : undefined);
  const wingOpacity = useWingBrightnessPulse(pulseWings && !flight);
  const halo = size * 1.8;
  const piece = (
    source: ImageSourcePropType,
    tint: string | undefined,
    motion: object | undefined,
    testID: string,
  ) => (
    <Animated.View testID={testID} style={[StyleSheet.absoluteFill, motion]}>
      <Image source={source} resizeMode="contain" tintColor={tint} style={{ width: size, height: size }} />
    </Animated.View>
  );
  const wing_motion = (value: Animated.Value | undefined) =>
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
        {piece(STROKE, theme.isDark ? "#FFFFFF" : undefined, strokeMotion, "brand-mark-stroke")}
        {WINGS.map((wing, index) => (
          <View key={index} style={StyleSheet.absoluteFill}>
            {piece(
              wing,
              theme.logoWing,
              { ...wing_motion(flight?.wings[index]), opacity: wingOpacity },
              `brand-mark-wing-${index + 1}`,
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The paywall's arrival: the sign-in flight played backwards along the same paths. Every piece starts away,
 * the left stroke flies in first, then the bottom, middle and top wings settle into it one at a time, each
 * easing past its place by a few points and back so it clicks in. Plays once per mounted mark; with Less
 * motion (or once played) the V is simply whole, and switching motion back on does not replay it.
 */
function useMarkArrival(active: boolean) {
  const { reduceMotion, motionReady } = useAccessibilityPreferences();
  const [flight] = useState<Flight>(() => {
    const start = active ? 1 : 0;
    return {
      wings: [new Animated.Value(start), new Animated.Value(start), new Animated.Value(start)],
      stroke: new Animated.Value(start),
      glow: new Animated.Value(start),
    };
  });
  const played = useRef(false);
  useEffect(() => {
    const pieces = [...flight.wings, flight.stroke, flight.glow];
    const settle = () => pieces.forEach((value) => value.setValue(0));
    if (!active) {
      settle();
      return;
    }
    if (!motionReady) return;
    if (reduceMotion || played.current) {
      settle();
      return;
    }
    played.current = true;
    // Plain per-piece delays rather than Animated.delay or stagger. The JS driver lets a stopped arrival
    // settle cleanly (a native-driven one left later screens waiting in tests); it's four small images, once.
    const land = (value: Animated.Value, delay: number, duration: number) =>
      Animated.timing(value, {
        toValue: 0,
        delay,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
        isInteraction: false,
      });
    const animation = Animated.parallel([
      Animated.timing(flight.glow, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
        isInteraction: false,
      }),
      land(flight.stroke, 120, 620),
      ...[...flight.wings].reverse().map((wing, order) => land(wing, 520 + order * 150, 560)),
    ]);
    animation.start();
    return () => {
      animation.stop();
      settle();
    };
  }, [active, motionReady, reduceMotion, flight]);
  return flight;
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
 * The welcome transition: when someone taps Sign in or Continue with Google, the top wing flies off to the right,
 * then the middle wing, then the bottom one, and the left stroke flies up and away. Then Sign in (or Google's
 * account picker) opens. With Less motion nothing moves and it opens straight away. Coming back to the screen, or a
 * Google sign-in that's closed or fails, puts the V together again.
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
  /** Flies the V off, then calls `done(true)`; `done(false)` if it was already flying or got interrupted. */
  const launch = useCallback(
    (done: (flew: boolean) => void) => {
      if (flying.current) {
        done(false);
        return;
      }
      const token = ++generation.current;
      if (reduceMotion) {
        done(true);
        return;
      }
      flying.current = true;
      // Each piece nudges back a few points before it takes off (see the interpolations), then speeds away.
      const take_off = (value: Animated.Value, duration: number) =>
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        });
      animation.current = Animated.parallel([
        Animated.stagger(
          130,
          flight.wings.map((wing) => take_off(wing, 460)),
        ),
        Animated.sequence([Animated.delay(380), take_off(flight.stroke, 520)]),
        Animated.timing(flight.glow, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]);
      animation.current.start(({ finished }) => {
        if (token !== generation.current) return done(false);
        if (!finished) flying.current = false;
        done(finished);
      });
    },
    [flight, reduceMotion],
  );
  const fly = useCallback(
    (then: () => void) =>
      launch((flew) => {
        if (flew) then();
      }),
    [launch],
  );
  /**
   * Continue with Google: the same flight, resolving once the V has gone (true) so the account picker opens then.
   * False means it didn't fly (already flying, or interrupted), and the caller should not open the picker.
   */
  const fly_away = useCallback(() => new Promise<boolean>((resolve) => launch(resolve)), [launch]);
  /** Puts the V back together after a Google sign-in is cancelled or fails, so it never stays off-screen. */
  const land = useCallback(() => {
    cancel();
    const pieces = [...flight.wings, flight.stroke, flight.glow];
    if (reduceMotion) {
      pieces.forEach((value) => value.setValue(0));
      return;
    }
    const token = generation.current;
    const back = Animated.parallel(
      pieces.map((value) =>
        Animated.timing(value, {
          toValue: 0,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );
    animation.current = back;
    back.start(() => {
      if (token === generation.current) animation.current = null;
    });
  }, [cancel, flight, reduceMotion]);
  return { fly, fly_away, land, flight, cancel };
}

const s = StyleSheet.create({
  glow: { position: "absolute" },
});
