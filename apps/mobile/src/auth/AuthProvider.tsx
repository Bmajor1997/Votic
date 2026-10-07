import Constants from "expo-constants";
import { PropsWithChildren, createContext, useContext, useEffect, useState } from "react";
import { setAuthTokenProvider } from "../api/authToken";
import { AuthBackend, VoticUser, createAuthBackend } from "./authBackend";

type AuthValue = {
  user: VoticUser | null;
  /** True once the saved session (if any) has been restored, so the app knows which screen to show. */
  hydrated: boolean;
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
const DEVELOPMENT_USER: VoticUser = { uid: "development", email: null, displayName: null };

export function AuthProvider({ children }: PropsWithChildren) {
  const [backend] = useState(createAuthBackend);
  const [user, setUser] = useState<VoticUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [developmentUser, setDevelopmentUser] = useState(false);

  useEffect(
    () =>
      backend.subscribe((next) => {
        setUser(next);
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

  const canContinueWithoutAccount =
    (__DEV__ || Constants.expoConfig?.extra?.previewTesting === true) && !backend.configured;
  return (
    <AuthContext.Provider
      value={{
        user: user ?? (developmentUser ? DEVELOPMENT_USER : null),
        hydrated,
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
          await backend.signOut();
        },
        deleteAccount: backend.deleteAccount,
        canContinueWithoutAccount,
        continueWithoutAccount() {
          if (canContinueWithoutAccount) setDevelopmentUser(true);
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
