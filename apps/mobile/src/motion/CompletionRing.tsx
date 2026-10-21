import { Animated, View } from "react-native";

/** Native-driven arc built from short rounded segments; no JS frame loop or SVG dependency. */
export function CompletionRing({
  progress,
  color,
  track,
}: {
  progress: Animated.Value;
  color: string;
  track: string;
}) {
  return (
    <View accessible={false} style={{ width: 88, height: 88, position: "absolute" }}>
      <View
        style={{ position: "absolute", inset: 0, borderRadius: 44, borderWidth: 4, borderColor: track }}
      />
      {Array.from({ length: 72 }, (_, index) => {
        const angle = (index * 2 * Math.PI) / 72;
        const fraction = index / 72;
        return (
          <Animated.View
            key={index}
            style={{
              position: "absolute",
              width: 4.2,
              height: 4,
              borderRadius: 0.8,
              left: 41.9 + 42 * Math.sin(angle),
              top: 42 - 42 * Math.cos(angle),
              backgroundColor: color,
              transform: [{ rotate: `${index * 5}deg` }],
              opacity: progress.interpolate({
                inputRange: [
                  0,
                  Math.max(0.001, (fraction - 0.85) / 0.15),
                  Math.max(0.002, (fraction - 0.85) / 0.15 + 0.03),
                ],
                outputRange: fraction < 0.85 ? [1, 1, 1] : [0, 0, 1],
                extrapolate: "clamp",
              }),
            }}
          />
        );
      })}
    </View>
  );
}
