import { MOTION } from "../motion/motionSpec";
import type { Animated } from "react-native";
import type { DocumentSourceRect } from "./DocumentTransitionProvider";

export type ReaderSourceTransform = {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
};

/**
 * The Reader opens from the tapped document card: at transition progress 0 it is scaled and moved onto
 * the card's rectangle, and at 1 it fills the window. Without a source card it simply fills the window.
 */
export function reader_source_transform(
  source: DocumentSourceRect | null,
  window: { width: number; height: number },
): ReaderSourceTransform {
  if (!source) return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
  return {
    scaleX: Math.max(0.05, source.width / window.width),
    scaleY: Math.max(0.05, source.height / window.height),
    translateX: source.x + source.width / 2 - window.width / 2,
    translateY: source.y + source.height / 2 - window.height / 2,
  };
}

/** Opening geometry and the matching Ask Votic/dock motion, calculated together for the current layout. */
export function reader_motion({
  source,
  window,
  transitionProgress,
  readerReady,
  askProgress,
  askPanelHeight,
  dockTravel,
}: {
  source: DocumentSourceRect | null;
  window: { width: number; height: number };
  transitionProgress: Animated.Value;
  readerReady: boolean;
  askProgress: Animated.Value;
  askPanelHeight: number;
  dockTravel: number;
}) {
  return {
    source: reader_source_transform(source, window),
    // The panel starts below the screen; the dock leaves and returns along the inverse path.
    askPanelSlide: askProgress.interpolate({ inputRange: [0, 1], outputRange: [askPanelHeight, 0] }),
    dockSlide: askProgress.interpolate({ inputRange: [0, 1], outputRange: [0, dockTravel] }),
    dockOpacity: askProgress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0, 0] }),
    // The document stays hidden until its opening layout is ready.
    readerOpacity: readerReady
      ? transitionProgress.interpolate({
          inputRange: [0, MOTION.document.textFrom, 1],
          outputRange: [0, 0, 1],
          extrapolate: "clamp",
        })
      : 0,
  };
}
