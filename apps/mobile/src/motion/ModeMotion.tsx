import { PropsWithChildren } from "react";
import { Animated } from "react-native";
import { MOTION } from "./motionSpec";
import { useMotionValue } from "./useMotionValue";

export function ModeMotion({ listening, children }: PropsWithChildren<{ listening: boolean }>) {
  const progress = useMotionValue(1, MOTION.mode.duration, 0);
  // Parent keys this on the mode, so a new control surface enters without retaining old focus targets.
  return (
    <Animated.View
      testID={listening ? "listen-controls-enter" : "read-controls-enter"}
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [MOTION.mode.distance, 0] }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
