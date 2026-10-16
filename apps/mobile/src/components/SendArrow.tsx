import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

const FLY_MS = 220;

/**
 * The send button's arrow. When a question is sent it lifts up and away, then the progress spinner fades in; when
 * Votic is ready again a new arrow rises back into place. With Reduce Motion it simply swaps.
 */
export function SendArrow({ busy, color = "#FFF" }: { busy: boolean; color?: string }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [lift] = useState(() => new Animated.Value(0));
  const [arrow] = useState(() => new Animated.Value(busy ? 0 : 1));
  const [spinner] = useState(() => new Animated.Value(busy ? 1 : 0));
  const wasBusy = useRef(busy);
  useEffect(() => {
    // Nothing moves when the composer first appears, only when a question is sent or answered.
    if (wasBusy.current === busy) return;
    wasBusy.current = busy;
    if (reduceMotion) {
      lift.setValue(0);
      arrow.setValue(busy ? 0 : 1);
      spinner.setValue(busy ? 1 : 0);
      return;
    }
    const motion = busy
      ? // Up and away: the question has been sent.
        Animated.sequence([
          Animated.parallel([
            Animated.timing(lift, {
              toValue: -16,
              duration: FLY_MS,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(arrow, { toValue: 0, duration: FLY_MS, useNativeDriver: true }),
          ]),
          Animated.timing(spinner, { toValue: 1, duration: 120, useNativeDriver: true }),
        ])
      : // Back from below, ready for the next question.
        Animated.parallel([
          Animated.timing(spinner, { toValue: 0, duration: 80, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(lift, { toValue: 12, duration: 0, useNativeDriver: true }),
            Animated.parallel([
              Animated.spring(lift, { toValue: 0, speed: 18, bounciness: 8, useNativeDriver: true }),
              Animated.timing(arrow, { toValue: 1, duration: FLY_MS, useNativeDriver: true }),
            ]),
          ]),
        ]);
    motion.start();
    return () => motion.stop();
  }, [arrow, busy, lift, reduceMotion, spinner]);
  return (
    <View style={s.box}>
      <Animated.View style={[s.layer, { opacity: spinner }]}>
        <ActivityIndicator testID="send-spinner" size="small" color={color} animating={busy} />
      </Animated.View>
      <Animated.View testID="send-arrow" style={{ opacity: arrow, transform: [{ translateY: lift }] }}>
        <Ionicons name="arrow-up" size={21} color={color} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
