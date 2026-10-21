import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

/** Interruptible, native-driven motion. Initial state is truthful; mounting never simulates a tap. */
export function useMotionValue(target: number, duration: number, initial = target) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [value] = useState(() => new Animated.Value(reduceMotion ? target : initial));
  useEffect(() => {
    value.stopAnimation();
    if (reduceMotion) {
      value.setValue(target);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [target, duration, reduceMotion, value]);
  return value;
}
