import { MOTION } from "../motion/motionSpec";
import { PropsWithChildren, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

export type DocumentSourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  heading?: { text: string; x: number; y: number; width: number; height: number };
};
type TransitionContextValue = {
  openReader: (source: DocumentSourceRect, navigate: () => void) => void;
  beginReader: () => void;
  closeReader: (navigate: () => void) => void;
  sourceRect: DocumentSourceRect | null;
  progress: Animated.Value;
  transitioning: boolean;
};
const TransitionContext = createContext<TransitionContextValue | null>(null);

export function DocumentTransitionProvider({ children }: PropsWithChildren) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [sourceRect, setSourceRect] = useState<DocumentSourceRect | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const locked = useRef(false);
  const [progress] = useState(() => new Animated.Value(0));

  const open_reader = useCallback(
    (source: DocumentSourceRect, navigate: () => void) => {
      if (locked.current) return;
      locked.current = true;
      progress.stopAnimation();
      progress.setValue(reduceMotion ? 1 : 0);
      setSourceRect(source);
      setTransitioning(true);
      navigate();
    },
    [progress, reduceMotion],
  );

  const begin_reader = useCallback(() => {
    if (reduceMotion) {
      progress.setValue(1);
      locked.current = false;
      setTransitioning(false);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: MOTION.document.open,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        locked.current = false;
        setTransitioning(false);
      }
    });
  }, [progress, reduceMotion]);

  // Closing always wins, even mid-opening: stop the opening animation and go back.
  const close_reader = useCallback(
    (navigate: () => void) => {
      locked.current = true;
      setTransitioning(true);
      progress.stopAnimation();
      if (reduceMotion) {
        progress.setValue(0);
        locked.current = false;
        setTransitioning(false);
        navigate();
        setSourceRect(null);
        return;
      }
      Animated.timing(progress, {
        toValue: 0,
        duration: MOTION.document.close,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        locked.current = false;
        setTransitioning(false);
        navigate();
        setSourceRect(null);
      });
    },
    [progress, reduceMotion],
  );

  const value = useMemo(
    () => ({
      openReader: open_reader,
      beginReader: begin_reader,
      closeReader: close_reader,
      sourceRect,
      progress,
      transitioning,
    }),
    [open_reader, begin_reader, close_reader, sourceRect, progress, transitioning],
  );
  return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>;
}

export function useDocumentTransition() {
  const value = useContext(TransitionContext);
  if (!value) throw new Error("useDocumentTransition must be used inside DocumentTransitionProvider");
  return value;
}
