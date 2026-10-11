import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { PropsWithChildren, createContext, useContext, useEffect, useRef, useState } from "react";
import { setAuthTokenProvider } from "../api/authToken";
import { AuthBackend, VoticUser, createAuthBackend } from "./authBackend";

type AuthValue = {
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
  const [backend] = useState(createAuthBackend);
  const [user, setUser] = useState<VoticUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
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
        setUser(next);
        // The first report is the saved session. Any account after that was signed in during this launch.
        // Token refreshes report the same account again, which changes nothing here.
        if (!reported.current || next?.uid !== reportedUid.current)
          setSessionRestored(!reported.current && Boolean(next));
        reported.current = true;
        reportedUid.current = next?.uid ?? null;
        setHydrated(true);
      }),
    [backend],
  );
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
    setAuthTokenProvider(() => backend.idToken());
    return () => setAuthTokenProvider(null);
  }, [backend]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? (developmentUser ? DEVELOPMENT_USER : null),
        hydrated: hydrated && exploreRestored,
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
