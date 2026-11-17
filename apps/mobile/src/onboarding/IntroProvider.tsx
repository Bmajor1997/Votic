import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { DEFAULT_INTRO, INTRO_KEY, Intro, parse_intro } from "./introModel";
import { useOnboarding } from "./OnboardingProvider";

type IntroValue = {
  intro: Intro;
  hydrated: boolean;
  update: (change: Partial<Intro>) => void;
};

const IntroContext = createContext<IntroValue | null>(null);

/**
 * The first-launch tour on this device. It shows before sign-in on a new install only: an install that already used
 * Votic, or a phone where someone has signed in, never sees it (signing out later goes straight to the account screen).
 */
export function IntroProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const legacy = useOnboarding();
  const [intro, setIntro] = useState<Intro>(DEFAULT_INTRO);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let current = true;
    void Promise.resolve(AsyncStorage.getItem(INTRO_KEY))
      .catch(() => null)
      .then((raw) => {
        if (!current) return;
        setIntro(parse_intro(raw));
        setHydrated(true);
      });
    return () => {
      current = false;
    };
  }, []);

  const update = useCallback((change: Partial<Intro>) => {
    setIntro((previous) => {
      const next = { ...previous, ...change };
      void Promise.resolve(AsyncStorage.setItem(INTRO_KEY, JSON.stringify(next))).catch(() => {});
      return next;
    });
  }, []);

  // Existing installs and signed-in phones are past the tour.
  const pastTour = Boolean(user) || legacy.personalized;
  // Saved so a later sign-out goes to the account screen; what's shown already counts it as done (below).
  useEffect(() => {
    if (hydrated && pastTour && !intro.done)
      void Promise.resolve(AsyncStorage.setItem(INTRO_KEY, JSON.stringify({ ...intro, done: true }))).catch(
        () => {},
      );
  }, [hydrated, pastTour, intro]);

  const value: IntroValue = {
    intro: pastTour && !intro.done ? { ...intro, done: true } : intro,
    hydrated,
    update,
  };
  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}

export function useIntro() {
  const value = useContext(IntroContext);
  if (!value) throw new Error("useIntro must be used inside IntroProvider");
  return value;
}
