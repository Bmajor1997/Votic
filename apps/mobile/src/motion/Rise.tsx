import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

/**
 * Paywall entrance: one timeline of about 900 ms. The hero and headline settle within the first 600 ms; the
 * benefits follow in a short stagger. It runs once, never loops, and never overshoots.
 */
export const RISE = { duration: 900, hero: 600, distance: 14 } as const;

const Timeline = createContext<Animated.Value | null>(null);

/** Plays the entrance once for everything inside it. With Reduce Motion (Votic's or the device's) it starts settled. */
export function RiseTimeline({ children }: PropsWithChildren) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) {
      progress.stopAnimation();
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: RISE.duration,
      easing: Easing.linear,
      // A single short JS-driven run for a handful of views. A native-driven animation started at mount kept
      // native-module work queued after the screen closed in Jest, breaking unrelated screens rendered next.
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, progress]);
  return <Timeline.Provider value={progress}>{children}</Timeline.Provider>;
}

/** Fades and settles slightly upward between `from` and `to` (milliseconds into the timeline). */
export function Rise({
  children,
  from = 0,
  to = RISE.hero,
  distance = RISE.distance,
  scaleFrom = 1,
  style,
}: PropsWithChildren<{
  from?: number;
  to?: number;
  distance?: number;
  scaleFrom?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  const progress = useContext(Timeline);
  if (!progress) return <Animated.View style={style}>{children}</Animated.View>;
  const start = Math.min(from, to - 1) / RISE.duration,
    end = Math.min(to, RISE.duration) / RISE.duration;
  // An ease-out curve inside this element's slice of the shared linear timeline.
  const local = progress.interpolate({
    inputRange: [0, start, start + (end - start) * 0.5, end, 1],
    outputRange: [0, 0, 0.82, 1, 1],
  });
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: local,
          transform: [
            { translateY: local.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
            { scale: local.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A short settle (about 240 ms) each time `key` changes, such as switching billing periods. Nothing moves on
 * first render or with Reduce Motion.
 */
export function SettleOnChange({ changeKey, children }: PropsWithChildren<{ changeKey: string }>) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [progress] = useState(() => new Animated.Value(1));
  const previousKey = useRef(changeKey);
  useLayoutEffect(() => {
    const changed = previousKey.current !== changeKey;
    previousKey.current = changeKey;
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    if (!changed) return;
    // Animated listeners update their own views; changing the value during render updates another component.
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [changeKey, reduceMotion, progress]);
  return (
    <Animated.View
      style={{
        gap: 16,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
