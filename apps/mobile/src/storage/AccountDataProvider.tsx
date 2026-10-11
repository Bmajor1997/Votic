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
import { legacyRecoveryAvailable, recoverLegacyDeviceData } from "./accountStorage";

type Value = {
  uid: string | null;
  canRecover: boolean;
  recover: () => Promise<void>;
  registerFlush: (flush: () => Promise<void>) => () => void;
};
const Context = createContext<Value | null>(null);

/** A changed account remounts all data consumers before any previous account's state can render. */
export function AccountDataProvider({ children }: PropsWithChildren) {
  const { user, hydrated } = useAuth();
  const uid = user?.uid ?? null;
  return hydrated ? (
    <AccountDataSession key={uid === null ? "signed-out" : `account:${uid}`} uid={uid}>
      {children}
    </AccountDataSession>
  ) : null;
}
function AccountDataSession({ uid, children }: PropsWithChildren<{ uid: string | null }>) {
  const [canRecover, setCanRecover] = useState(false);
  const [revision, setRevision] = useState(0);
  const flushers = useRef(new Set<() => Promise<void>>());
  const pending = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    const clear = () => publishWidgetSnapshot(JSON.stringify(signedOutSnapshot()));
    clear();
    return clear;
  }, [uid]);
  useEffect(() => {
    mounted.current = true;
    if (uid)
      void legacyRecoveryAvailable(uid)
        .then((available) => {
          if (mounted.current) setCanRecover(available);
        })
        .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [uid]);
  return (
    <Context.Provider
      value={{
        uid,
        canRecover,
        registerFlush(flush) {
          flushers.current.add(flush);
          return () => {
            flushers.current.delete(flush);
          };
        },
        recover() {
          if (!uid) return Promise.reject(new Error("Sign in before recovering your older library."));
          if (pending.current) return pending.current;
          pending.current = (async () => {
            await Promise.all([...flushers.current].map((flush) => flush()));
            await recoverLegacyDeviceData(uid);
            if (mounted.current) {
              setCanRecover(false);
              setRevision((value) => value + 1);
            }
          })().finally(() => {
            pending.current = null;
          });
          return pending.current;
        },
      }}
    >
      <DataRevision key={revision}>{children}</DataRevision>
    </Context.Provider>
  );
}
function DataRevision({ children }: PropsWithChildren) {
  return <>{children}</>;
}
export function useAccountData() {
  const value = useContext(Context);
  if (!value) throw new Error("useAccountData must be used inside AccountDataProvider");
  return value;
}
