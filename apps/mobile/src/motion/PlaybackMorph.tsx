import { memo } from "react";
import { Animated, View } from "react-native";
import { MOTION, playback_slices } from "./motionSpec";
import { useMotionValue } from "./useMotionValue";

const slices = playback_slices();
/** Geometry morph, not a video or a fake audio visualizer. The button owns its accessible name. */
export const PlaybackMorph = memo(function PlaybackMorph({
  playing,
  size,
  color,
}: {
  playing: boolean;
  size: number;
  color: string;
}) {
  const progress = useMotionValue(playing ? 1 : 0, MOTION.playback.duration);
  const unit = size / 24;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={playing ? "playback-morph-pause" : "playback-morph-play"}
      style={{ width: size, height: size }}
    >
      {slices.map((slice, index) => (
        <Animated.View
          key={index}
          style={{
            position: "absolute",
            left: size / 2 - 0.5,
            top: size / 2 + slice.y * unit - (slice.height * unit) / 2,
            width: 1,
            height: slice.height * unit,
            backgroundColor: color,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [slice.fromX * unit, slice.toX * unit],
                }),
              },
              {
                scaleX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [slice.fromWidth * unit, slice.toWidth * unit],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
});
