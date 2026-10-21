import { useRef } from "react";
import { Text, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useDocumentTransition } from "../navigation/DocumentTransitionProvider";
import { saved_motion_trigger, useMotionFeedback } from "./MotionFeedback";

/** Keeps presentation-only state out of the reader's playback and document lifecycle. */
export function useReaderMotion() {
  const titleNode = useRef<Text>(null);
  const rootNode = useRef<View>(null);
  const { event, show } = useMotionFeedback();
  const transition = useDocumentTransition();
  const { reduceMotion } = useAccessibilityPreferences();
  const titleOpacity =
    !reduceMotion && transition.transitioning && transition.sourceRect?.heading
      ? transition.progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0, 0, 1] })
      : 1;
  return {
    titleNode,
    rootNode,
    titleOpacity,
    showSaved: show,
    bookmarkTrigger: saved_motion_trigger(event, "bookmark"),
  };
}
