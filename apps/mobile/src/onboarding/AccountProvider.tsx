import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { AccountUser } from "../auth/authTypes";
import { AppServices, createAppServices } from "../config/appServices";
import { Entitlement, UNKNOWN_ENTITLEMENT } from "../subscription/subscriptionTypes";
import { DeviceHistory, EntryRoute, resolveEntryRoute } from "./entryRoute";
import {
  highlightModeFor,
  newOnboardingState,
  OnboardingState,
  PersonalizationAnswers,
  QUESTIONS,
} from "./onboardingModel";
import {
  DevelopmentBypass,
  loadDevelopmentBypass,
  loadDeviceHistory,
  loadOnboardingState,
  removeOnboardingState,
  saveDevelopmentBypass,
  saveOnboardingState,
} from "./onboardingStorage";

type AccountContextValue = {
  services: AppServices;
  route: EntryRoute;
  user: AccountUser | null;
  deviceHistory: DeviceHistory | null;
  onboarding: OnboardingState | null;
  entitlement: Entitlement;
  developmentBypass: DevelopmentBypass;
  /** Development builds may offer bypasses for unconfigured services; release builds never do. */
  isDevelopment: boolean;
  createAccount: (input: { firstName: string; email: string; password: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  /** Saves answers as they change, so leaving mid-question loses nothing. */
  setAnswers: (answers: PersonalizationAnswers) => void;
  setStep: (step: number) => void;
  /** Ends the questions (answered or skipped) and applies what can take effect now. */
  finishPersonalization: (options: { skipped: boolean }) => void;
  /** Re-applies answers edited later from Settings. */
  savePersonalization: (answers: PersonalizationAnswers) => void;
  /** After "Start Using Votic": enters the app from now on. */
  completeOnboarding: () => void;
  setEntitlement: (entitlement: Entitlement) => void;
  setDevelopmentBypass: (value: Partial<DevelopmentBypass>) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

/**
 * Holds who is signed in, where they are in setup, and whether they have a subscription — three separate
 * facts — and derives which part of Votic to show from them.
 */
export function AccountProvider({
  children,
  services: providedServices,
  isDevelopment = __DEV__,
  now = Date.now,
}: PropsWithChildren<{ services?: AppServices; isDevelopment?: boolean; now?: () => number }>) {
  const [services] = useState(() => providedServices ?? createAppServices());
  const { auth, subscriptions } = services;
  const { setHighlightMode } = useAccessibilityPreferences();
  const [deviceHistory, setDeviceHistory] = useState<DeviceHistory | null>(null);
  const [developmentBypass, setBypass] = useState<DevelopmentBypass>({ account: false, paywall: false });
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  // Setup and subscription state are stored with the account they belong to, so another account's
  // state is never shown while the new account's is loading.
  const [stored, setStored] = useState<{ uid: string; state: OnboardingState } | null>(null);
  const [checked, setChecked] = useState<{ uid: string; entitlement: Entitlement } | null>(null);
  // Signing in on a device without saved setup means this account already went through it elsewhere.
  const lastAction = useRef<"create" | "sign-in" | null>(null);
  const identifiedUid = useRef<string | null>(null);
  const uid = user?.uid ?? null;
  const uidRef = useRef(uid);
  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);
  const onboarding = uid && stored?.uid === uid ? stored.state : null;
  const entitlement = uid && checked?.uid === uid ? checked.entitlement : UNKNOWN_ENTITLEMENT;
  const checkingEntitlement = Boolean(uid && !subscriptions.unavailableReason && checked?.uid !== uid);
  const setEntitlement = useCallback((next: Entitlement) => {
    const current = uidRef.current;
    if (current) setChecked({ uid: current, entitlement: next });
  }, []);

  useEffect(() => {
    void Promise.all([
      loadDeviceHistory().catch((): DeviceHistory => "new"),
      loadDevelopmentBypass(isDevelopment).catch(() => ({ account: false, paywall: false })),
    ]).then(([history, bypass]) => {
      setDeviceHistory(history);
      setBypass(bypass);
    });
  }, [isDevelopment]);

  useEffect(
    () =>
      auth.subscribe((next) => {
        setUser(next);
        setAuthReady(true);
      }),
    [auth],
  );

  // Load (or start) this account's setup whenever the signed-in account changes.
  useEffect(() => {
    let current = true;
    if (!uid) return;
    void loadOnboardingState(uid)
      .catch(() => null)
      .then(async (saved) => {
        let state = saved;
        if (!state) {
          state = newOnboardingState();
          if (lastAction.current === "sign-in") {
            const time = now();
            state = {
              ...state,
              personalizationCompletedAt: time,
              personalizationSkipped: true,
              completedAt: time,
            };
          }
          await saveOnboardingState(uid, state).catch(() => {});
        }
        if (current) setStored({ uid, state });
      });
    return () => {
      current = false;
    };
  }, [uid, now]);

  // Ask the store about this account's subscription. Signing out keeps the subscription with the account.
  useEffect(() => {
    if (!uid) {
      if (identifiedUid.current) void subscriptions.reset();
      identifiedUid.current = null;
      return;
    }
    if (subscriptions.unavailableReason) return;
    identifiedUid.current = uid;
    let current = true;
    void subscriptions.identify(uid).then((result) => {
      if (current) setChecked({ uid, entitlement: result });
    });
    return () => {
      current = false;
    };
  }, [uid, subscriptions]);

  useEffect(() => subscriptions.onChange(setEntitlement), [subscriptions, setEntitlement]);

  const update = useCallback(
    (change: (state: OnboardingState) => OnboardingState) => {
      if (!uid) return;
      setStored((previous) => {
        if (previous?.uid !== uid) return previous;
        const next = change(previous.state);
        void saveOnboardingState(uid, next).catch(() => {});
        return { uid, state: next };
      });
    },
    [uid],
  );

  function applyImmediatePreferences(answers: PersonalizationAnswers) {
    const highlight = highlightModeFor(answers.listening);
    if (highlight) setHighlightMode(highlight);
  }

  const route = resolveEntryRoute({
    hydrated: authReady,
    deviceHistory,
    user,
    onboarding,
    entitlement: entitlement.status,
    checkingEntitlement,
    developmentBypass,
    accountsAvailable: auth.available,
    subscriptionsAvailable: !subscriptions.unavailableReason,
  });

  const value: AccountContextValue = {
    services,
    route,
    user,
    deviceHistory,
    onboarding,
    entitlement,
    developmentBypass,
    isDevelopment,
    async createAccount(input) {
      lastAction.current = "create";
      await auth.createAccount(input);
    },
    async signIn(input) {
      lastAction.current = "sign-in";
      await auth.signIn(input);
    },
    async signOut() {
      await auth.signOut();
      lastAction.current = null;
      setChecked(null);
    },
    async deleteAccount(password) {
      const deletedUid = uid;
      await auth.deleteAccount(password);
      if (deletedUid) void removeOnboardingState(deletedUid).catch(() => {});
      lastAction.current = null;
      setChecked(null);
    },
    setAnswers(answers) {
      update((state) => ({ ...state, answers }));
    },
    setStep(step) {
      update((state) => ({ ...state, currentStep: Math.min(QUESTIONS.length - 1, Math.max(0, step)) }));
    },
    finishPersonalization({ skipped }) {
      if (onboarding) applyImmediatePreferences(onboarding.answers);
      update((state) => ({ ...state, personalizationCompletedAt: now(), personalizationSkipped: skipped }));
    },
    savePersonalization(answers) {
      applyImmediatePreferences(answers);
      update((state) => ({
        ...state,
        answers,
        personalizationCompletedAt: state.personalizationCompletedAt ?? now(),
        personalizationSkipped: false,
      }));
    },
    completeOnboarding() {
      update((state) => ({ ...state, completedAt: state.completedAt ?? now() }));
    },
    setEntitlement,
    setDevelopmentBypass(change) {
      if (!isDevelopment) return;
      setBypass((current) => {
        const next = { ...current, ...change };
        void saveDevelopmentBypass(next).catch(() => {});
        return next;
      });
    },
  };
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside AccountProvider");
  return value;
}
