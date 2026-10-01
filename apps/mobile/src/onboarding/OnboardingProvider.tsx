import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useState } from "react";

export const ONBOARDING_KEY = "votic.mobile.onboarding.v2";
const LEGACY_TOUR_KEY = "votic.mobile.first-run-tour.v1";
/** Keys only an existing Votic install would have. They are read before any provider can write its own. */
const EXISTING_INSTALL_KEYS = [
  LEGACY_TOUR_KEY,
  "votic.mobile.documents.v1",
  "votic.mobile.library.v2",
  "votic.mobile.collections.v1",
  "votic.mobile.theme.v1",
  "votic.mobile.accessibility.v1",
];
export const TIP_IDS = ["reader-listen", "reader-bookmark", "reader-ask"] as const;
export type TipId = (typeof TIP_IDS)[number];

export type OnboardingState = {
  /** Personalization has been finished or skipped, so the app opens straight to Home. */
  personalized: boolean;
  tipsSeen: TipId[];
  checklistDismissed: boolean;
  askedVotic: boolean;
};
const NEW_INSTALL: OnboardingState = {
  personalized: false,
  tipsSeen: [],
  checklistDismissed: false,
  askedVotic: false,
};
// People who already use Votic know their way around, so they skip personalization and tips.
const EXISTING_INSTALL: OnboardingState = {
  personalized: true,
  tipsSeen: [...TIP_IDS],
  checklistDismissed: true,
  askedVotic: false,
};

export function parseOnboardingState(raw: string | null): OnboardingState | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;
    return {
      personalized: saved.personalized === true,
      tipsSeen: Array.isArray(saved.tipsSeen) ? TIP_IDS.filter((id) => saved.tipsSeen.includes(id)) : [],
      checklistDismissed: saved.checklistDismissed === true,
      askedVotic: saved.askedVotic === true,
    };
  } catch {
    return null;
  }
}

/** Reads the saved state, or decides whether this is a new or existing install the first time v2 runs. */
export async function loadOnboardingState(): Promise<OnboardingState> {
  const saved = parseOnboardingState(await AsyncStorage.getItem(ONBOARDING_KEY));
  if (saved) return saved;
  const existing = await AsyncStorage.multiGet(EXISTING_INSTALL_KEYS);
  const state = existing.some(([, value]) => value !== null) ? EXISTING_INSTALL : NEW_INSTALL;
  await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(state)).catch(() => {});
  return state;
}

type OnboardingValue = OnboardingState & {
  completePersonalization: () => void;
  markTipSeen: (id: TipId) => void;
  dismissChecklist: () => void;
  recordAskedVotic: () => void;
  /** Brings back the Getting Started card and in-context tips. */
  showTipsAgain: () => void;
};
const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<OnboardingState | null>(null);
  useEffect(() => {
    let mounted = true;
    loadOnboardingState()
      .catch(() => NEW_INSTALL)
      .then((loaded) => {
        if (mounted) setState(loaded);
      });
    return () => {
      mounted = false;
    };
  }, []);
  function update(change: (current: OnboardingState) => OnboardingState) {
    setState((current) => {
      if (!current) return current;
      const next = change(current);
      void AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }
  // Nothing below renders until the install check is done. Otherwise the theme and library providers
  // could save their defaults first and make a brand-new install look like an existing one.
  if (!state) return null;
  return (
    <OnboardingContext.Provider
      value={{
        ...state,
        completePersonalization: () => update((current) => ({ ...current, personalized: true })),
        markTipSeen: (id) =>
          update((current) =>
            current.tipsSeen.includes(id) ? current : { ...current, tipsSeen: [...current.tipsSeen, id] },
          ),
        dismissChecklist: () => update((current) => ({ ...current, checklistDismissed: true })),
        recordAskedVotic: () =>
          update((current) => (current.askedVotic ? current : { ...current, askedVotic: true })),
        showTipsAgain: () => update((current) => ({ ...current, tipsSeen: [], checklistDismissed: false })),
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return value;
}

/** The first tip, in order, that is unseen and whose moment has come. Only one tip shows at a time. */
export function nextTip(order: { id: TipId; ready: boolean }[], seen: TipId[]): TipId | null {
  for (const tip of order) {
    if (seen.includes(tip.id)) continue;
    // Tips teach in sequence, so a later tip waits for the earlier ones.
    return tip.ready ? tip.id : null;
  }
  return null;
}
