import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  AccountHighlightPreferences,
  useAccessibilityPreferences,
} from "../accessibility/AccessibilityProvider";
import { useAuth } from "../auth/AuthProvider";
import { AccountPurposePreferences, useVoticPurpose } from "../personalization/PurposeProvider";
import { normalizePlaybackRate } from "../playback/rates";
import {
  AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
  loadAccountPreferences,
  saveAccountPreferences,
} from "./accountPreferences";
import {
  highlightModeFor,
  newOnboardingState,
  OnboardingState,
  PersonalizationAnswers,
  QUESTIONS,
} from "./onboardingModel";
import { loadAccountSetup, saveAccountSetup } from "./onboardingStorage";
import { useOnboarding } from "./OnboardingProvider";

type AccountSetupValue = {
  /** This account's setup, or null while it loads (or when signed out). */
  setup: OnboardingState | null;
  loading: boolean;
  /** The five questions have been answered or skipped. */
  personalized: boolean;
  /** "Votic is ready for you" has been seen, so the app opens to Home. */
  handedOff: boolean;
  /**
   * The Home Screen widgets screen has been seen (or doesn't apply: on the web, which has no widgets, and
   * for accounts that finished setup before it existed).
   */
  widgetsIntroduced: boolean;
  /** Saved as answers change, so leaving mid-question loses nothing. */
  setAnswers: (answers: PersonalizationAnswers) => void;
  setStep: (step: number) => void;
  /** Ends the questions (answered or skipped) and applies what can take effect now. */
  finishPersonalization: (options: { skipped: boolean }) => void;
  /** Saves answers edited later from Settings and applies them. */
  savePersonalization: (answers: PersonalizationAnswers) => void;
  /** After "Start using Votic" on "Votic is ready for you": the app opens to Home from now on. */
  completeHandoff: () => void;
  /** After the Home Screen widgets screen: setup moves on to "Votic is ready for you". */
  completeWidgetsIntro: () => void;
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
  const deviceAccessibility = useAccessibilityPreferences();
  const devicePurpose = useVoticPurpose();
  const uid = user?.uid ?? null;
  // Kept with the account it belongs to, so another account's setup never shows while this one loads.
  const [stored, setStored] = useState<{ uid: string; state: OnboardingState } | null>(null);
  const setup = uid && stored?.uid === uid ? stored.state : null;
  const [preferences, setPreferences] = useState<{ uid: string; value: AccountPreferences } | null>(null);
  const effective = uid && preferences?.uid === uid ? preferences.value : DEFAULT_ACCOUNT_PREFERENCES;

  // Facts read once, when this account's setup is first created on this device.
  const isNewAccount = Boolean(user?.isNewAccount);
  const legacyPersonalized = legacy.personalized;
  useEffect(() => {
    if (!uid || !deviceAccessibility.hydrated || !devicePurpose.hydrated) return;
    let current = true;
    void Promise.all([
      loadAccountSetup(uid).catch(() => null),
      loadAccountPreferences(uid).catch(() => null),
    ]).then(async ([saved, savedPreferences]) => {
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
      if (!current) return;
      // Migrate legacy device preferences only into the restored account. A different/new account
      // gets defaults plus its own answers, never the account that just signed out's settings.
      const baseline = sessionRestored
        ? {
            explanationStyle: devicePurpose.explanationStyle,
            highlightMode: deviceAccessibility.highlightMode,
            defaultPlaybackRate: devicePurpose.defaultPlaybackRate,
          }
        : DEFAULT_ACCOUNT_PREFERENCES;
      const value = savedPreferences ?? {
        ...baseline,
        explanationStyle: state.answers.explanationStyle ?? baseline.explanationStyle,
        highlightMode: highlightModeFor(state.answers.listening) ?? baseline.highlightMode,
      };
      if (!savedPreferences) void saveAccountPreferences(uid, value).catch(() => {});
      setPreferences({ uid, value });
      setStored({ uid, state });
    });
    return () => {
      current = false;
    };
    // Only a change of account reloads setup; the facts above are read as they were at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, deviceAccessibility.hydrated, devicePurpose.hydrated]);

  function changePreferences(change: Partial<AccountPreferences>) {
    if (!uid) return;
    setPreferences((previous) => {
      if (previous?.uid !== uid) return previous;
      const value = { ...previous.value, ...change };
      void saveAccountPreferences(uid, value).catch(() => {});
      return { uid, value };
    });
  }

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
    changePreferences({
      ...(highlight ? { highlightMode: highlight } : {}),
      ...(answers.explanationStyle ? { explanationStyle: answers.explanationStyle } : {}),
    });
  }

  const value: AccountSetupValue = {
    setup,
    loading: Boolean(uid && (!setup || preferences?.uid !== uid)),
    personalized: Boolean(setup?.personalizationCompletedAt),
    handedOff: Boolean(setup?.completedAt),
    widgetsIntroduced:
      Platform.OS === "web" || Boolean(setup?.widgetsIntroducedAt) || Boolean(setup?.completedAt),
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
    completeHandoff() {
      update((state) => ({ ...state, completedAt: state.completedAt ?? now() }));
    },
    completeWidgetsIntro() {
      update((state) => ({ ...state, widgetsIntroducedAt: state.widgetsIntroducedAt ?? now() }));
    },
  };
  return (
    <AccountSetupContext.Provider value={value}>
      <AccountPurposePreferences
        explanationStyle={effective.explanationStyle}
        setExplanationStyle={(explanationStyle) => changePreferences({ explanationStyle })}
        defaultPlaybackRate={effective.defaultPlaybackRate}
        setDefaultPlaybackRate={(rate) =>
          changePreferences({ defaultPlaybackRate: normalizePlaybackRate(rate) })
        }
      >
        <AccountHighlightPreferences
          highlightMode={effective.highlightMode}
          setHighlightMode={(highlightMode) => changePreferences({ highlightMode })}
        >
          {children}
        </AccountHighlightPreferences>
      </AccountPurposePreferences>
    </AccountSetupContext.Provider>
  );
}

export function useAccountSetup() {
  const value = useContext(AccountSetupContext);
  if (!value) throw new Error("useAccountSetup must be used inside AccountSetupProvider");
  return value;
}
