import { MOTION } from "../motion/motionSpec";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, AppState, Easing } from "react-native";
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
  const phase = useRef<"idle" | "preparing" | "opening" | "open" | "closing">("idle");
  const generation = useRef(0);
  const pendingClose = useRef<(() => void) | null>(null);
  const [progress] = useState(() => new Animated.Value(0));

  // Interrupted native animations must leave a usable screen and release the navigation lock.
  const settle_transition = useCallback(() => {
    if (phase.current === "idle" || phase.current === "open") return;
    const closing = phase.current === "closing";
    phase.current = closing ? "idle" : "open";
    generation.current += 1;
    const navigate = pendingClose.current;
    pendingClose.current = null;
    progress.stopAnimation();
    progress.setValue(closing ? 0 : 1);
    setTransitioning(false);
    if (closing) {
      setSourceRect(null);
      navigate?.();
    }
  }, [progress]);

  const open_reader = useCallback(
    (source: DocumentSourceRect, navigate: () => void) => {
      if (["preparing", "opening", "closing"].includes(phase.current)) return;
      generation.current += 1;
      phase.current = "preparing";
      progress.stopAnimation();
      progress.setValue(reduceMotion ? 1 : 0);
      setSourceRect(source);
      setTransitioning(true);
      navigate();
    },
    [progress, reduceMotion],
  );

  const begin_reader = useCallback(() => {
    // Layout/text callbacks may arrive after Close or after an interruption has settled the screen.
    if (["closing", "opening", "open"].includes(phase.current)) return;
    phase.current = "opening";
    const token = ++generation.current;
    if (reduceMotion) return settle_transition();
    Animated.timing(progress, {
      toValue: 1,
      duration: MOTION.document.open,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      if (token === generation.current) settle_transition();
    });
  }, [progress, reduceMotion, settle_transition]);

  // Closing wins over opening; duplicate requests and stale callbacks cannot navigate twice.
  const close_reader = useCallback(
    (navigate: () => void) => {
      if (phase.current === "closing") return;
      const token = ++generation.current;
      phase.current = "closing";
      pendingClose.current = navigate;
      setTransitioning(true);
      progress.stopAnimation();
      if (reduceMotion) return settle_transition();
      Animated.timing(progress, {
        toValue: 0,
        duration: MOTION.document.close,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (token === generation.current) settle_transition();
      });
    },
    [progress, reduceMotion, settle_transition],
  );

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") settle_transition();
    });
    return () => {
      listener.remove();
      generation.current += 1;
      phase.current = "idle";
      pendingClose.current = null;
      progress.stopAnimation();
    };
  }, [progress, settle_transition]);

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
