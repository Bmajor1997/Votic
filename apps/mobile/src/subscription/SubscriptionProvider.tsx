import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AppState } from "react-native";
import { store_deadline } from "./storeDeadline";
import { account_storage_key } from "../storage/accountStorage";
import { account_writable, write_account_data } from "../storage/accountDeletion";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { LegalLinks } from "../config/appConfig";
import { has_access } from "./entitlement";
import { create_subscription_service, legal_links } from "./subscriptionService";
import { Entitlement, SubscriptionService, UNKNOWN_ENTITLEMENT } from "./subscriptionTypes";

/** Development and marked preview builds only: lets testers past the paywall when the build can't make real purchases. */
const DEVELOPMENT_BYPASS_KEY = "votic.mobile.development-paywall-bypass.v1";

type SubscriptionValue = {
  service: SubscriptionService;
  legal: LegalLinks;
  /** The signed-in account's subscription, as RevenueCat reports it. Never a locally saved "paid" flag. */
  entitlement: Entitlement;
  /** True while the store is first asked about this account, so the paywall doesn't flash for subscribers. */
  checking: boolean;
  recoveryError: string | null;
  /** Whether the paid part of Votic is open to this account. */
  access: boolean;
  /** Development and marked preview builds without store purchases can skip the paywall; release builds never can. */
  canBypass: boolean;
  bypass: () => void;
  resetBypass: () => Promise<void>;
  setEntitlement: (entitlement: Entitlement) => void;
  /** Asks the store again, e.g. after a network failure. */
  refresh: () => Promise<Entitlement>;
};

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

export function SubscriptionProvider({
  children,
  // The same builds that may be explored without an account (see AuthProvider): local development, and EAS
  // builds made with the "preview" profile. Production and unmarked release builds never qualify.
  isDevelopment = __DEV__ || Constants.expoConfig?.extra?.previewTesting === true,
}: PropsWithChildren<{ isDevelopment?: boolean }>) {
  const [service] = useState(create_subscription_service);
  const [legal] = useState(legal_links);
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  // Stored with the account it belongs to, so one account's subscription is never shown for another.
  const [checked, setChecked] = useState<{ uid: string; entitlement: Entitlement } | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [bypassState, setBypassState] = useState<{ uid: string; bypassed: boolean } | null>(null);
  const [observedUid, setObservedUid] = useState(uid);
  // Discard the previous session's result before children render, including signing back into the same account.
  if (observedUid !== uid) {
    setObservedUid(uid);
    setChecked(null);
    setRecoveryError(null);
    setBypassState(null);
  }
  const identified = useRef<string | null>(null);
  const uidRef = useRef(uid);
  useLayoutEffect(() => {
    uidRef.current = uid;
  }, [uid]);
  const settled = useRef<string | null>(null);
  const canBypass = isDevelopment && Boolean(service.unavailableReason);

  // Until the saved development bypass is read, access isn't known yet (see `checking`).
  const bypassLoaded = !uid || bypassState?.uid === uid;
  useEffect(() => {
    if (!canBypass || !uid) return;
    let current = true;
    // The legacy device-wide flag has no known owner and must never grant a new account access.
    void AsyncStorage.getItem(account_storage_key(DEVELOPMENT_BYPASS_KEY, uid))
      .catch(() => null)
      .then((value) => {
        if (current && uidRef.current === uid) setBypassState({ uid, bypassed: value === "yes" });
      });
    return () => {
      current = false;
    };
  }, [canBypass, uid]);

  // Link purchases to the Votic account, so they follow the person to other devices and reinstalls.
  useEffect(() => {
    settled.current = null;
    if (!uid) {
      if (identified.current) void service.reset();
      identified.current = null;
      return;
    }
    if (service.unavailableReason) return;
    identified.current = uid;
    let current = true;
    void store_deadline(service.identify(uid))
      .catch((error) => {
        if (current && uidRef.current === uid)
          setRecoveryError(
            error instanceof Error ? error.message : "Membership is unavailable. Please retry.",
          );
        return UNKNOWN_ENTITLEMENT;
      })
      .then((result) => {
        if (current && uidRef.current === uid) {
          settled.current = uid;
          setChecked({ uid, entitlement: result });
        }
      });
    return () => {
      current = false;
    };
  }, [uid, service]);

  // Purchase/restore/refresh callbacks retain the account that started them.
  const set_entitlement = useCallback(
    (next: Entitlement) => {
      if (uid && uidRef.current === uid && settled.current === uid) setChecked({ uid, entitlement: next });
    },
    [uid],
  );
  // Renewals, expirations, and refunds arrive here while Votic is open.
  useEffect(
    () =>
      service.onChange((next, owner) => {
        if (owner === uidRef.current && owner === settled.current)
          setChecked({ uid: owner, entitlement: next });
      }),
    [service],
  );

  const entitlement = uid && checked?.uid === uid ? checked.entitlement : UNKNOWN_ENTITLEMENT;
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !uid || settled.current !== uid || !account_writable(uid)) return;
      void store_deadline(service.refresh())
        .then((next) => {
          if (uidRef.current === uid && next.status !== "unknown") set_entitlement(next);
        })
        .catch(() => {}); // Preserve known cached access on a transient refresh failure.
    });
    return () => subscription.remove();
  }, [service, set_entitlement, uid]);
  const checking =
    Boolean(uid && !service.unavailableReason && checked?.uid !== uid) || (canBypass && !bypassLoaded);
  const value: SubscriptionValue = {
    service,
    legal,
    entitlement,
    checking,
    recoveryError,
    access:
      has_access(entitlement.status) ||
      (canBypass && Boolean(uid && bypassState?.uid === uid && bypassState.bypassed)),
    canBypass,
    bypass() {
      if (!canBypass || !uid || uidRef.current !== uid || !account_writable(uid)) return;
      setBypassState({ uid, bypassed: true });
      void write_account_data(uid, () =>
        AsyncStorage.setItem(account_storage_key(DEVELOPMENT_BYPASS_KEY, uid), "yes"),
      ).catch(() => {});
    },
    async resetBypass() {
      if (!canBypass || !uid || uidRef.current !== uid || !account_writable(uid)) return;
      await write_account_data(uid, () =>
        AsyncStorage.removeItem(account_storage_key(DEVELOPMENT_BYPASS_KEY, uid)),
      );
      if (uidRef.current === uid) setBypassState({ uid, bypassed: false });
    },
    setEntitlement: set_entitlement,
    async refresh() {
      try {
        const next = await store_deadline(service.refresh());
        set_entitlement(next);
        setRecoveryError(null);
        return next;
      } catch (error) {
        setRecoveryError(error instanceof Error ? error.message : "Membership is unavailable. Please retry.");
        throw error;
      }
    },
  };
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("useSubscription must be used inside SubscriptionProvider");
  return value;
}
