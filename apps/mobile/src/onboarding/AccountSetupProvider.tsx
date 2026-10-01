import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useAuth } from "../auth/AuthProvider";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import {
  highlightModeFor,
  newOnboardingState,
  OnboardingState,
  PersonalizationAnswers,
  QUESTIONS,
} from "./onboardingModel";
import { loadAccountSetup, saveAccountSetup } from "./onboardingStorage";
import { useOnboarding } from "./OnboardingProvider";

/** Something the person chose on "Votic is ready for you", carried out once Home is showing. */
export type HandoffAction = "add-document";

type AccountSetupValue = {
  /** This account's setup, or null while it loads (or when signed out). */
  setup: OnboardingState | null;
  loading: boolean;
  /** The five questions have been answered or skipped. */
  personalized: boolean;
  /** "Votic is ready for you" has been seen, so the app opens to Home. */
  handedOff: boolean;
  /** Saved as answers change, so leaving mid-question loses nothing. */
  setAnswers: (answers: PersonalizationAnswers) => void;
  setStep: (step: number) => void;
  /** Ends the questions (answered or skipped) and applies what can take effect now. */
  finishPersonalization: (options: { skipped: boolean }) => void;
  /** Saves answers edited later from Settings and applies them. */
  savePersonalization: (answers: PersonalizationAnswers) => void;
  completeHandoff: (action?: HandoffAction) => void;
  pendingAction: HandoffAction | null;
  clearPendingAction: () => void;
};

const AccountSetupContext = createContext<AccountSetupValue | null>(null);

/**
 * Where the signed-in account is in setup. Separate from signing in (Firebase) and from paying
 * (RevenueCat): finishing setup never grants access by itself.
 */
export function AccountSetupProvider({
  children,
  now = Date.now,
}: PropsWithChildren<{ now?: () => number }>) {
  const { user, sessionRestored } = useAuth();
  const legacy = useOnboarding();
  const { setHighlightMode } = useAccessibilityPreferences();
  const { setExplanationStyle } = useVoticPurpose();
  const uid = user?.uid ?? null;
  // Kept with the account it belongs to, so another account's setup never shows while this one loads.
  const [stored, setStored] = useState<{ uid: string; state: OnboardingState } | null>(null);
  const [pendingAction, setPendingAction] = useState<HandoffAction | null>(null);
  const setup = uid && stored?.uid === uid ? stored.state : null;

  // Facts read once, when this account's setup is first created on this device.
  const isNewAccount = Boolean(user?.isNewAccount);
  const legacyPersonalized = legacy.personalized;
  useEffect(() => {
    if (!uid) return;
    let current = true;
    void loadAccountSetup(uid)
      .catch(() => null)
      .then(async (saved) => {
        let state = saved;
        if (!state) {
          // No setup saved here: a new account starts setup. An existing account signing in (another
          // device, a reinstall) already went through it. A session from before per-account setup keeps
          // whatever this device had decided.
          const done = sessionRestored ? legacyPersonalized : !isNewAccount;
          const time = now();
          state = done
            ? {
                ...newOnboardingState(),
                personalizationCompletedAt: time,
                personalizationSkipped: true,
                completedAt: time,
              }
            : newOnboardingState();
          await saveAccountSetup(uid, state).catch(() => {});
        }
        if (current) setStored({ uid, state });
      });
    return () => {
      current = false;
    };
    // Only a change of account reloads setup; the facts above are read as they were at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const update = useCallback(
    (change: (state: OnboardingState) => OnboardingState) => {
      if (!uid) return;
      setStored((previous) => {
        if (previous?.uid !== uid) return previous;
        const next = change(previous.state);
        void saveAccountSetup(uid, next).catch(() => {});
        return { uid, state: next };
      });
    },
    [uid],
  );

  function apply(answers: PersonalizationAnswers) {
    const highlight = highlightModeFor(answers.listening);
    if (highlight) setHighlightMode(highlight);
    if (answers.explanationStyle) setExplanationStyle(answers.explanationStyle);
  }

  const value: AccountSetupValue = {
    setup,
    loading: Boolean(uid && !setup),
    personalized: Boolean(setup?.personalizationCompletedAt),
    handedOff: Boolean(setup?.completedAt),
    setAnswers: (answers) => update((state) => ({ ...state, answers })),
    setStep: (step) =>
      update((state) => ({ ...state, currentStep: Math.min(QUESTIONS.length - 1, Math.max(0, step)) })),
    finishPersonalization({ skipped }) {
      if (setup) apply(setup.answers);
      legacy.completePersonalization();
      update((state) => ({ ...state, personalizationCompletedAt: now(), personalizationSkipped: skipped }));
    },
    savePersonalization(answers) {
      apply(answers);
      update((state) => ({
        ...state,
        answers,
        personalizationCompletedAt: state.personalizationCompletedAt ?? now(),
        personalizationSkipped: false,
      }));
    },
    completeHandoff(action) {
      setPendingAction(action ?? null);
      update((state) => ({ ...state, completedAt: state.completedAt ?? now() }));
    },
    pendingAction,
    clearPendingAction: () => setPendingAction(null),
  };
  return <AccountSetupContext.Provider value={value}>{children}</AccountSetupContext.Provider>;
}

export function useAccountSetup() {
  const value = useContext(AccountSetupContext);
  if (!value) throw new Error("useAccountSetup must be used inside AccountSetupProvider");
  return value;
}
