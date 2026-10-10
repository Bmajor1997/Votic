import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
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
import { hasAccess } from "./entitlement";
import { createSubscriptionService, legalLinks } from "./subscriptionService";
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
  /** Whether the paid part of Votic is open to this account. */
  access: boolean;
  /** Development and marked preview builds without store purchases can skip the paywall; release builds never can. */
  canBypass: boolean;
  bypass: () => void;
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
  const [service] = useState(createSubscriptionService);
  const [legal] = useState(legalLinks);
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  // Stored with the account it belongs to, so one account's subscription is never shown for another.
  const [checked, setChecked] = useState<{ uid: string; entitlement: Entitlement } | null>(null);
  const [observedUid, setObservedUid] = useState(uid);
  // Discard the previous session's result before children render, including signing back into the same account.
  if (observedUid !== uid) {
    setObservedUid(uid);
    setChecked(null);
  }
  const [bypassed, setBypassed] = useState(false);
  const identified = useRef<string | null>(null);
  const uidRef = useRef(uid);
  useLayoutEffect(() => {
    uidRef.current = uid;
  }, [uid]);
  const settled = useRef<string | null>(null);
  const canBypass = isDevelopment && Boolean(service.unavailableReason);

  useEffect(() => {
    if (!canBypass) return;
    void AsyncStorage.getItem(DEVELOPMENT_BYPASS_KEY)
      .then((value) => setBypassed(value === "yes"))
      .catch(() => {});
  }, [canBypass]);

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
    void service
      .identify(uid)
      .catch(() => UNKNOWN_ENTITLEMENT)
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
  const setEntitlement = useCallback(
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
  const checking = Boolean(uid && !service.unavailableReason && checked?.uid !== uid);
  const value: SubscriptionValue = {
    service,
    legal,
    entitlement,
    checking,
    access: hasAccess(entitlement.status) || (canBypass && bypassed),
    canBypass,
    bypass() {
      if (!canBypass) return;
      setBypassed(true);
      void AsyncStorage.setItem(DEVELOPMENT_BYPASS_KEY, "yes").catch(() => {});
    },
    setEntitlement,
    async refresh() {
      const next = await service.refresh();
      setEntitlement(next);
      return next;
    },
  };
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("useSubscription must be used inside SubscriptionProvider");
  return value;
}
