import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AppState, Pressable, Text, View } from "react-native";
import { flush_diagnostics, set_diagnostic_owner } from "../storage/diagnostics";
import * as Speech from "expo-speech";
import { notification_player } from "../playback/notificationPlayback";
import { publish_widget_snapshot } from "../widgets/widgetBridge";
import { signed_out_snapshot } from "../widgets/widgetSnapshot";
import { erase_scan_draft } from "../documents/scanDraftStorage";
import { clear_import_cache } from "../documents/importCache";
import { PropsWithChildren, createContext, useContext, useEffect, useRef, useState } from "react";
import { set_auth_token_provider } from "../api/authToken";
import { resume_local_deletions } from "../storage/accountDeletion";
import { resume_library_restores } from "../storage/libraryBackup";
import { AuthBackend, VoticUser, create_auth_backend } from "./authBackend";

import { create_home_entrance_session, HomeEntranceSession } from "../motion/homeEntranceSession";

type AuthValue = {
  homeEntrance: HomeEntranceSession;
  user: VoticUser | null;
  /** True once the saved session (if any) has been restored, so the app knows which screen to show. */
  hydrated: boolean;
  /** True when the current account came from a session saved before this launch, not a sign-in just now. */
  sessionRestored: boolean;
  configured: boolean;
  googleAvailable: boolean;
  appleAvailable: boolean;
  createAccount: AuthBackend["createAccount"];
  signIn: AuthBackend["signIn"];
  sendPasswordReset: AuthBackend["sendPasswordReset"];
  signInWithApple: AuthBackend["signInWithApple"];
  signInWithGoogle: AuthBackend["signInWithGoogle"];
  signOut: () => Promise<void>;
  deleteAccount: AuthBackend["deleteAccount"];
  prepareDeleteAccount: AuthBackend["prepareDeleteAccount"];
  /** Development and marked preview builds without Firebase can be explored. Production requires an account. */
  canContinueWithoutAccount: boolean;
  continueWithoutAccount: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);
/** Remembers "Explore Votic without an account" across launches, in builds that allow it. */
export const EXPLORE_SESSION_KEY = "votic.mobile.explore-session.v1";
const DEVELOPMENT_USER: VoticUser = {
  uid: "development",
  email: null,
  displayName: null,
  isNewAccount: true,
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [backend] = useState(create_auth_backend);
  const [homeEntrance] = useState(create_home_entrance_session);
  const [user, setUser] = useState<VoticUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [deletionsRecovered, setDeletionsRecovered] = useState(false);
  const [recoveryError, setRecoveryError] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    void resume_local_deletions(async (uid) => {
      await erase_scan_draft(uid);
      const player = notification_player();
      if (player?.get_state().accountId === uid) await player.stop();
      await player?.clear_activity?.(uid);
    })
      .then(async (recovered) => {
        if (recovered) {
          await Speech.stop();
          await notification_player()?.stop();
          publish_widget_snapshot(JSON.stringify(signed_out_snapshot()), true);
          clear_import_cache();
        }
        await resume_library_restores();
        if (current) setDeletionsRecovered(true);
      })
      .catch(() => {
        if (current) setRecoveryError(true);
      });
    return () => {
      current = false;
    };
  }, [recoveryAttempt]);
  const [sessionRestored, setSessionRestored] = useState(false);
  const reported = useRef(false);
  const reportedUid = useRef<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [developmentUser, setDevelopmentUser] = useState(false);
  const canContinueWithoutAccount =
    (__DEV__ || Constants.expoConfig?.extra?.previewTesting === true) && !backend.configured;
  // Until the saved explore choice is read, the app can't know whether to show Welcome or Votic.
  const [exploreRestored, setExploreRestored] = useState(!canContinueWithoutAccount);
  useEffect(() => {
    if (!canContinueWithoutAccount) return;
    let mounted = true;
    AsyncStorage.getItem(EXPLORE_SESSION_KEY)
      .then((saved) => {
        if (mounted && saved === "1") setDevelopmentUser(true);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setExploreRestored(true);
      });
    return () => {
      mounted = false;
    };
  }, [canContinueWithoutAccount]);

  useEffect(
    () =>
      backend.subscribe((next) => {
        homeEntrance.observe(next?.uid ?? null, !reported.current && Boolean(next));
        set_diagnostic_owner(next?.uid ?? null);
        setUser(next);
        // The first report is the saved session. Any account after that was signed in during this launch.
        // Token refreshes report the same account again, which changes nothing here.
        if (!reported.current || next?.uid !== reportedUid.current)
          setSessionRestored(!reported.current && Boolean(next));
        reported.current = true;
        reportedUid.current = next?.uid ?? null;
        setHydrated(true);
      }),
    [backend, homeEntrance],
  );
  useEffect(() => {
    if (!user) return;
    void flush_diagnostics(user.uid);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void flush_diagnostics(user.uid);
    });
    return () => listener.remove();
  }, [user]);
  useEffect(() => {
    let mounted = true;
    void backend.appleAvailable().then((available) => {
      if (mounted) setAppleAvailable(available);
    });
    return () => {
      mounted = false;
    };
  }, [backend]);
  // Votic's server checks this token when it requires accounts.
  useEffect(() => {
    set_auth_token_provider(() => backend.idToken());
    return () => set_auth_token_provider(null);
  }, [backend]);

  if (recoveryError)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text accessibilityRole="alert">
          Votic could not finish pending library recovery or account cleanup. Your library is hidden until
          recovery can finish.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setRecoveryError(false);
            setRecoveryAttempt((value) => value + 1);
          }}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <Text>Retry device recovery</Text>
        </Pressable>
      </View>
    );
  return (
    <AuthContext.Provider
      value={{
        homeEntrance,
        user: user ?? (developmentUser ? DEVELOPMENT_USER : null),
        hydrated: hydrated && exploreRestored && deletionsRecovered,
        sessionRestored: sessionRestored && !developmentUser,
        configured: backend.configured,
        googleAvailable: backend.googleAvailable,
        appleAvailable,
        createAccount: backend.createAccount,
        signIn: backend.signIn,
        sendPasswordReset: backend.sendPasswordReset,
        signInWithApple: backend.signInWithApple,
        signInWithGoogle: backend.signInWithGoogle,
        async signOut() {
          setDevelopmentUser(false);
          void AsyncStorage.removeItem(EXPLORE_SESSION_KEY).catch(() => {});
          await backend.signOut();
        },
        deleteAccount: backend.deleteAccount,
        prepareDeleteAccount: backend.prepareDeleteAccount,
        canContinueWithoutAccount,
        continueWithoutAccount() {
          if (!canContinueWithoutAccount) return;
          setDevelopmentUser(true);
          void AsyncStorage.setItem(EXPLORE_SESSION_KEY, "1").catch(() => {});
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
