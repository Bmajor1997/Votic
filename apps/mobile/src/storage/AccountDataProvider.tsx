import { notification_player } from "../playback/notificationPlayback";
import { publish_widget_snapshot } from "../widgets/widgetBridge";
import { signed_out_snapshot } from "../widgets/widgetSnapshot";
import * as Speech from "expo-speech";
import { AppState, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVoticTheme } from "../theme/ThemeProvider";
import { clear_import_cache } from "../documents/importCache";
import {
  account_deletion_pending,
  account_writable,
  erase_local_account,
  finish_local_deletion,
  mark_account_deletion,
  on_remote_account_deletion,
} from "./accountDeletion";
import { check_account_status } from "../api/voticApi";
import { library_restore_pending, resume_library_restores } from "./libraryBackup";
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
  legacy_auto_recovery_eligible,
  legacy_recovery_available,
  recover_legacy_device_data,
} from "./accountStorage";

type Value = {
  uid: string | null;
  canRecover: boolean;
  recover: () => Promise<void>;
  /** Saves pending changes before older data is merged in. */
  registerFlush: (flush: () => Promise<void>) => () => void;
  /** Reads this account's data again after older data is merged in, without reloading the app. */
  registerReload: (reload: () => Promise<void>) => () => void;
  deleteAccount: () => Promise<void>;
  runLibraryTask: <T>(task: (account: string) => Promise<T>) => Promise<T>;
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
  const auth = useAuth();
  const { theme } = useVoticTheme();
  const [deletionPending, setDeletionPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const deletingRef = useRef(false);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const maintenanceCommit = useRef<(() => void) | null>(null);
  const maintenanceRunning = useRef(false);
  useEffect(() => {
    if (maintenance) {
      maintenanceCommit.current?.();
      maintenanceCommit.current = null;
    }
  }, [maintenance]);
  const [canRecover, setCanRecover] = useState(false);
  // The older shared library moves over before this account's data loads, so it never looks empty first.
  const [ready, setReady] = useState(!uid);
  const [flushers] = useState(() => new Set<() => Promise<void>>());
  const [reloaders] = useState(() => new Set<() => Promise<void>>());
  const pending = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    let current = true;
    if (uid)
      void account_deletion_pending(uid)
        .then((value) => {
          if (current) setDeletionPending(value);
        })
        .catch(() => {});
    return () => {
      current = false;
    };
  }, [uid]);
  async function eraseDeviceData(account: string) {
    await Promise.allSettled([...flushers].map((flush) => flush()));
    await Speech.stop();
    await notification_player()?.stop();
    publish_widget_snapshot(JSON.stringify(signed_out_snapshot()), true);
    clear_import_cache();
    await erase_local_account(account);
  }
  async function deleteAccount() {
    if (!uid || deletingRef.current) return;
    deletingRef.current = true;
    try {
      // A stale login or unconfigured backend must fail before erasing device data.
      await auth.prepareDeleteAccount(uid);
      await mark_account_deletion(uid);
      setDeletionPending(true);
      setDeleting(true);
      setDeletionError(null);
      await eraseDeviceData(uid);
      await auth.deleteAccount(uid);
      await finish_local_deletion(uid);
    } catch (error) {
      if (mounted.current)
        setDeletionError(
          error instanceof Error
            ? error.message
            : "Deletion is not finished. Sign out and sign back in, then retry.",
        );
      throw error;
    } finally {
      deletingRef.current = false;
      if (mounted.current) setDeleting(false);
    }
  }
  useEffect(() => {
    if (!uid) return;
    on_remote_account_deletion(() => {
      if (deletingRef.current) return;
      deletingRef.current = true;
      setDeletionPending(true);
      setDeleting(true);
      void (async () => {
        try {
          // This device may have erased data but still need to retry Firebase/vendor deletion.
          // Do not discard its durable intent or sign it out before it can finish.
          if (await account_deletion_pending(uid)) return;
          await mark_account_deletion(uid);
          await eraseDeviceData(uid);
          await finish_local_deletion(uid);
          if (mounted.current) await auth.signOut();
        } catch {
          if (mounted.current)
            setDeletionError("Device cleanup could not finish. Restart Votic and retry account deletion.");
        } finally {
          deletingRef.current = false;
          if (mounted.current) setDeleting(false);
        }
      })();
    });
    const check = () => {
      if (!__DEV__) void check_account_status().catch(() => {});
    };
    void Promise.resolve().then(check);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      on_remote_account_deletion(null);
      subscription.remove();
    };
    // One listener per account; the session is remounted whenever the UID changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  // Widgets are cleared only when this account goes away (sign-out or a switch), never on every launch:
  // WidgetSync sends the new account's snapshot once its data has loaded.
  useLayoutEffect(
    () => () => {
      publish_widget_snapshot(JSON.stringify(signed_out_snapshot()));
      void notification_player()
        ?.stop()
        .catch(() => {});
    },
    [],
  );
  useEffect(() => {
    mounted.current = true;
    if (uid)
      void (async () => {
        try {
          if (await legacy_auto_recovery_eligible(uid, sessionRestored))
            await recover_legacy_device_data(uid);
        } catch {
          // Settings still offers recovery; the backup is unchanged.
        }
        if (!mounted.current) return;
        setReady(true);
        setCanRecover(await legacy_recovery_available(uid).catch(() => false));
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
        deleteAccount,
        async runLibraryTask(task) {
          if (!uid || maintenanceRunning.current || deletingRef.current || !account_writable(uid))
            throw new Error("Your library is busy. Please try again.");
          maintenanceRunning.current = true;
          const flush = [...flushers];
          try {
            await Speech.stop();
            await notification_player()?.stop();
            // Unmount data consumers before snapshot/restore; their final writes finish before the task.
            const committed = new Promise<void>((resolve) => {
              maintenanceCommit.current = resolve;
            });
            setMaintenance(true);
            await committed;
            await Promise.all(flush.map((task) => task()));
            if (!mounted.current || !account_writable(uid)) throw new Error("The account changed.");
            const result = await task(uid);
            if (!mounted.current || !account_writable(uid)) throw new Error("The account changed.");
            return result;
          } finally {
            const interrupted = await library_restore_pending(uid).catch(() => true);
            if (interrupted)
              setMaintenanceError("Restore was interrupted. Retry to finish before opening your library.");
            else {
              setMaintenance(false);
              maintenanceRunning.current = false;
            }
          }
        },
        recover() {
          if (!uid) return Promise.reject(new Error("Sign in before recovering your older library."));
          if (pending.current) return pending.current;
          pending.current = (async () => {
            await Promise.all([...flushers].map((flush) => flush()));
            await recover_legacy_device_data(uid);
            await Promise.all([...reloaders].map((reload) => reload()));
            if (mounted.current) setCanRecover(false);
          })().finally(() => {
            pending.current = null;
          });
          return pending.current;
        },
      }}
    >
      {ready && !maintenance ? children : null}
      {maintenance ? (
        <SafeAreaView
          style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.background }}
        >
          <Text accessibilityRole={maintenanceError ? "alert" : "text"} style={{ color: theme.text }}>
            {maintenanceError || "Saving your library. Please keep Votic open…"}
          </Text>
          {maintenanceError ? (
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: "center" }}
              onPress={() =>
                void resume_library_restores()
                  .then(() => {
                    setMaintenanceError(null);
                    setMaintenance(false);
                    maintenanceRunning.current = false;
                  })
                  .catch(() => {})
              }
            >
              <Text style={{ color: theme.accentText }}>Retry restore</Text>
            </Pressable>
          ) : null}
        </SafeAreaView>
      ) : null}
      <Modal visible={deletionPending} onRequestClose={() => {}} animationType="none">
        <SafeAreaView
          style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.background }}
        >
          <View style={{ gap: 20 }}>
            <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 24 }}>
              Finish account deletion
            </Text>
            <Text accessibilityRole={deletionError ? "alert" : "text"} style={{ color: theme.text }}>
              {deleting
                ? "Removing your account data…"
                : deletionError ||
                  "Deletion was interrupted. Retry to finish. Your local library will be erased."}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={() => void deleteAccount().catch(() => {})}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <Text style={{ color: theme.accentText }}>Retry deletion</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={() => void auth.signOut()}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <Text style={{ color: theme.accentText }}>Sign out to sign in again</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
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
