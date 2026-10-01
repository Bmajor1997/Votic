import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { LegalLinks } from "../config/appConfig";
import { hasAccess } from "./entitlement";
import { createSubscriptionService, legalLinks } from "./subscriptionService";
import { Entitlement, SubscriptionService, UNKNOWN_ENTITLEMENT } from "./subscriptionTypes";

/** Development builds only: lets testers past the paywall when this build can't make real purchases. */
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
  /** Development builds without store purchases can skip the paywall; release builds never can. */
  canBypass: boolean;
  bypass: () => void;
  setEntitlement: (entitlement: Entitlement) => void;
  /** Asks the store again, e.g. after a network failure. */
  refresh: () => Promise<Entitlement>;
};

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

export function SubscriptionProvider({
  children,
  isDevelopment = __DEV__,
}: PropsWithChildren<{ isDevelopment?: boolean }>) {
  const [service] = useState(createSubscriptionService);
  const [legal] = useState(legalLinks);
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  // Stored with the account it belongs to, so one account's subscription is never shown for another.
  const [checked, setChecked] = useState<{ uid: string; entitlement: Entitlement } | null>(null);
  const [bypassed, setBypassed] = useState(false);
  const identified = useRef<string | null>(null);
  const uidRef = useRef(uid);
  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);
  const canBypass = isDevelopment && Boolean(service.unavailableReason);

  useEffect(() => {
    if (!canBypass) return;
    void AsyncStorage.getItem(DEVELOPMENT_BYPASS_KEY)
      .then((value) => setBypassed(value === "yes"))
      .catch(() => {});
  }, [canBypass]);

  // Link purchases to the Votic account, so they follow the person to other devices and reinstalls.
  useEffect(() => {
    if (!uid) {
      if (identified.current) void service.reset();
      identified.current = null;
      return;
    }
    if (service.unavailableReason) return;
    identified.current = uid;
    let current = true;
    void service.identify(uid).then((result) => {
      if (current) setChecked({ uid, entitlement: result });
    });
    return () => {
      current = false;
    };
  }, [uid, service]);

  const setEntitlement = useCallback((next: Entitlement) => {
    const current = uidRef.current;
    if (current) setChecked({ uid: current, entitlement: next });
  }, []);
  // Renewals, expirations, and refunds arrive here while Votic is open.
  useEffect(() => service.onChange(setEntitlement), [service, setEntitlement]);

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
