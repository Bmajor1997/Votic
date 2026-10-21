import { PropsWithChildren, useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { MOTION } from "./motionSpec";

/** Only confirmed saves trigger this one-shot. Mounts and passage changes do not celebrate. */
export function FeedbackPop({ trigger, children }: PropsWithChildren<{ trigger: number | undefined }>) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [progress] = useState(() => new Animated.Value(1));
  useEffect(() => {
    progress.stopAnimation();
    if (!trigger || reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: MOTION.feedback.duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [trigger, reduceMotion, progress]);
  return (
    <Animated.View
      style={{
        transform: [
          { scale: progress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.92, 1.08, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
