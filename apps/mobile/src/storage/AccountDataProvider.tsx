import { publishWidgetSnapshot } from "../widgets/widgetBridge";
import { signedOutSnapshot } from "../widgets/widgetSnapshot";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  legacyAutoRecoveryEligible,
  legacyRecoveryAvailable,
  recoverLegacyDeviceData,
} from "./accountStorage";

type Value = {
  uid: string | null;
  canRecover: boolean;
  recover: () => Promise<void>;
  /** Saves pending changes before older data is merged in. */
  registerFlush: (flush: () => Promise<void>) => () => void;
  /** Reads this account's data again after older data is merged in, without reloading the app. */
  registerReload: (reload: () => Promise<void>) => () => void;
};
const Context = createContext<Value | null>(null);

/** A changed account remounts all data consumers before any previous account's state can render. */
export function AccountDataProvider({ children }: PropsWithChildren) {
  const { user, hydrated, sessionRestored } = useAuth();
  const uid = user?.uid ?? null;
  return hydrated ? (
    <AccountDataSession
      key={uid === null ? "signed-out" : `account:${uid}`}
      uid={uid}
      sessionRestored={sessionRestored}
    >
      {children}
    </AccountDataSession>
  ) : null;
}
function AccountDataSession({
  uid,
  sessionRestored,
  children,
}: PropsWithChildren<{ uid: string | null; sessionRestored: boolean }>) {
  const [canRecover, setCanRecover] = useState(false);
  // The older shared library moves over before this account's data loads, so it never looks empty first.
  const [ready, setReady] = useState(!uid);
  const [flushers] = useState(() => new Set<() => Promise<void>>());
  const [reloaders] = useState(() => new Set<() => Promise<void>>());
  const pending = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  // Widgets are cleared only when this account goes away (sign-out or a switch), never on every launch:
  // WidgetSync sends the new account's snapshot once its data has loaded.
  useLayoutEffect(() => () => publishWidgetSnapshot(JSON.stringify(signedOutSnapshot())), []);
  useEffect(() => {
    mounted.current = true;
    if (uid)
      void (async () => {
        try {
          if (await legacyAutoRecoveryEligible(uid, sessionRestored)) await recoverLegacyDeviceData(uid);
        } catch {
          // Settings still offers recovery; the backup is unchanged.
        }
        if (!mounted.current) return;
        setReady(true);
        setCanRecover(await legacyRecoveryAvailable(uid).catch(() => false));
      })();
    return () => {
      mounted.current = false;
    };
    // sessionRestored is read once, as it was when this account's session started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  // Stable, so the providers that register don't re-register on every render.
  const [registerFlush] = useState(() => register(flushers));
  const [registerReload] = useState(() => register(reloaders));
  return (
    <Context.Provider
      value={{
        uid,
        canRecover,
        registerFlush,
        registerReload,
        recover() {
          if (!uid) return Promise.reject(new Error("Sign in before recovering your older library."));
          if (pending.current) return pending.current;
          pending.current = (async () => {
            await Promise.all([...flushers].map((flush) => flush()));
            await recoverLegacyDeviceData(uid);
            await Promise.all([...reloaders].map((reload) => reload()));
            if (mounted.current) setCanRecover(false);
          })().finally(() => {
            pending.current = null;
          });
          return pending.current;
        },
      }}
    >
      {ready ? children : null}
    </Context.Provider>
  );
}
function register(set: Set<() => Promise<void>>) {
  return (task: () => Promise<void>) => {
    set.add(task);
    return () => {
      set.delete(task);
    };
  };
}
export function useAccountData() {
  const value = useContext(Context);
  if (!value) throw new Error("useAccountData must be used inside AccountDataProvider");
  return value;
}
