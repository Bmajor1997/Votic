import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Animated, AppState, Easing } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { useAccountSetup } from "../onboarding/AccountSetupProvider";
import { useSubscription } from "../subscription/SubscriptionProvider";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useActivity } from "../activity/ActivityProvider";
import { MOTION } from "../motion/motionSpec";
import { LIVE_CHANGES, NO_LIVE_LETTERS, live_letters } from "../motion/homeLogoTimeline";

/**
 * The signed-in wordmark entrance, shared by every page header.
 *
 * One animated value drives every wordmark that shows the entrance, so switching to Documents, Notes, Settings or a
 * settings page mid-entrance shows the same moment and it carries on from there. Home starts it (once per fresh
 * sign-in, when Home is ready and in front); leaving Home no longer finishes it. It finishes at once for Reduce motion,
 * when the app goes to the background, if it can't start in time, or at sign-out. It runs on the native driver and
 * never takes touches, so navigation stays responsive.
 */
type Phase = "waiting" | "running" | "done";
type Entrance = {
  progress: Animated.Value;
  phase: Phase;
  /** Letters whose robot is on screen now (the rest are drawn as plain letters). */
  live: readonly boolean[];
  setHomeReady: (ready: boolean) => void;
  setHomeFocused: (focused: boolean) => void;
};

const EntranceContext = createContext<Entrance | null>(null);
/** The finished wordmark, for pages that appear before the entrance starts. */
const FINISHED = new Animated.Value(1);
const noop = () => {};
const STATIC: Entrance = {
  progress: FINISHED,
  phase: "done",
  live: NO_LIVE_LETTERS,
  setHomeReady: noop,
  setHomeFocused: noop,
};

/** The shared entrance, or a finished one outside the signed-in app. */
export function useWordmarkEntrance() {
  return useContext(EntranceContext) ?? STATIC;
}
/** Whether a header should take part in the entrance (it exists and has not finished). */
export function useWordmarkEntranceActive() {
  const entrance = useContext(EntranceContext);
  return entrance !== null && entrance.phase !== "done";
}
/** What a header that joined the entrance should show: the finished logo until the entrance actually starts. */
export function shownProgress(entrance: Entrance) {
  return entrance.phase === "waiting" ? FINISHED : entrance.progress;
}

export function WordmarkEntranceProvider({ children }: PropsWithChildren) {
  const { user, hydrated, homeEntrance } = useAuth();
  const setup = useAccountSetup();
  const subscription = useSubscription();
  const activity = useActivity();
  const { reduceMotion, motionReady } = useAccessibilityPreferences();
  const uid = user?.uid ?? null;
  const generation = homeEntrance.key();

  // A new entrance for each sign-in generation; restored sessions and token refreshes start finished.
  const fresh = () => {
    const pending = homeEntrance.pending(uid, generation) && !reduceMotion;
    return {
      generation,
      progress: new Animated.Value(pending ? 0 : 1),
      phase: (pending ? "waiting" : "done") as Phase,
    };
  };
  const [session, setSession] = useState(fresh);
  const current = session.generation === generation ? session : fresh();
  if (current !== session) setSession(current);
  const { progress, phase } = current;
  const setPhase = useCallback(
    (next: Phase) => setSession((value) => (value.progress === progress ? { ...value, phase: next } : value)),
    [progress],
  );

  // Which robots are on screen, updated a few times (never per frame) from when the entrance started.
  const [live, setLive] = useState<{ progress: Animated.Value; letters: readonly boolean[] } | null>(null);
  const startedAt = useRef(0);
  const [homeReady, setHomeReady] = useState(false);
  const [homeFocused, setHomeFocused] = useState(false);
  const [active, setActive] = useState(
    AppState.currentState !== "background" && AppState.currentState !== "inactive",
  );

  const prepared =
    homeReady &&
    hydrated &&
    !setup.loading &&
    setup.handedOff &&
    subscription.access &&
    !subscription.checking &&
    activity.hydrated &&
    motionReady;

  const animation = useRef<Animated.CompositeAnimation | null>(null);
  // Finishing shows the final logo at once; the phase is recorded separately (from callbacks only).
  const finishNow = useCallback(() => {
    animation.current?.stop();
    animation.current = null;
    homeEntrance.claim(uid, generation);
    progress.setValue(1);
  }, [homeEntrance, uid, generation, progress]);
  const settle = useCallback(() => {
    finishNow();
    setPhase("done");
  }, [finishNow, setPhase]);

  // Going to the background finishes the entrance rather than resuming a half-built logo later.
  const latestSettle = useRef(settle);
  useEffect(() => {
    latestSettle.current = settle;
  }, [settle]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state !== "active") latestSettle.current();
    });
    return () => listener.remove();
  }, []);

  // Reduce motion finishes it on every page at once.
  useEffect(() => {
    if (phase === "done" || !reduceMotion) return;
    finishNow();
    const record = setTimeout(() => setPhase("done"), 0);
    return () => clearTimeout(record);
  }, [phase, reduceMotion, finishNow, setPhase]);

  // Start: once, from Home, when everything is ready. A timeout reveals the logo if it never gets going.
  useEffect(() => {
    if (phase !== "waiting" || reduceMotion || !homeFocused) return;
    const deadline = setTimeout(() => settle(), MOTION.homeLogo.settleDeadline);
    if (!prepared || !active) return () => clearTimeout(deadline);
    const frame = requestAnimationFrame(() => {
      clearTimeout(deadline);
      if (!homeEntrance.claim(uid, generation)) {
        settle();
        return;
      }
      progress.setValue(0);
      try {
        const run = Animated.timing(progress, {
          toValue: 1,
          duration: MOTION.homeLogo.duration,
          easing: Easing.bezier(...MOTION.homeLogo.easing),
          useNativeDriver: true,
          isInteraction: false,
        });
        animation.current = run;
        startedAt.current = Date.now();
        setLive({ progress, letters: live_letters(0) });
        setPhase("running");
        run.start(({ finished }) => {
          if (!finished || animation.current !== run) return;
          animation.current = null;
          progress.setValue(1);
          setPhase("done");
        });
      } catch {
        settle();
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
    };
  }, [
    phase,
    prepared,
    homeFocused,
    active,
    reduceMotion,
    progress,
    uid,
    generation,
    homeEntrance,
    settle,
    setPhase,
  ]);

  // While running, page changes don't touch it; a safety deadline reveals the finished logo if the native driver
  // never reports completion.
  useEffect(() => {
    if (phase !== "running") return;
    const duration = MOTION.homeLogo.duration;
    const elapsed = Date.now() - startedAt.current;
    const changes = LIVE_CHANGES.map((t) =>
      setTimeout(
        () => setLive({ progress, letters: live_letters((Date.now() - startedAt.current) / duration) }),
        // A little after each change, so the robot is already invisible (or not yet visible) at the swap.
        Math.max(0, t * duration - elapsed + 16),
      ),
    );
    const deadline = setTimeout(() => settle(), MOTION.homeLogo.duration + MOTION.homeLogo.settleDeadline);
    return () => {
      clearTimeout(deadline);
      changes.forEach(clearTimeout);
    };
  }, [phase, settle, progress]);

  // Sign-out (or leaving the signed-in app) finishes whatever was running.
  useEffect(() => () => animation.current?.stop(), [progress]);

  const letters = phase === "running" && live?.progress === progress ? live.letters : NO_LIVE_LETTERS;
  const value = useMemo(
    () => ({ progress, phase, live: letters, setHomeReady, setHomeFocused }),
    [progress, phase, letters],
  );
  return <EntranceContext.Provider value={value}>{children}</EntranceContext.Provider>;
}
