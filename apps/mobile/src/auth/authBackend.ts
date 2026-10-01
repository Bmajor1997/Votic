import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseApp, getApp, getApps, initializeApp } from "@firebase/app";
import * as FirebaseAuth from "@firebase/auth";
import {
  Auth,
  GoogleAuthProvider,
  OAuthProvider,
  Persistence,
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "@firebase/auth";
import { Platform } from "react-native";
import { SignInCancelled } from "./authErrors";

export type VoticUser = { uid: string; email: string | null; displayName: string | null };

/** Everything the app needs from an identity provider. Tests replace this module with an in-memory fake. */
export type AuthBackend = {
  /** False when this build has no Firebase settings, so nobody can sign in. */
  configured: boolean;
  googleAvailable: boolean;
  appleAvailable: () => Promise<boolean>;
  subscribe: (listener: (user: VoticUser | null) => void) => () => void;
  createAccount: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  idToken: () => Promise<string | null>;
};

// EXPO_PUBLIC_ values are inlined at build time, so each must be read by its full name.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

function unavailable(message: string) {
  const error = new Error(message);
  error.name = "VoticAuthUnavailable";
  return error;
}

function toVoticUser(user: User | null): VoticUser | null {
  return user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null;
}

let cachedAuth: Auth | null = null;
function firebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  // The React Native build of @firebase/auth exports getReactNativePersistence, but its public typings omit it.
  const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  };
  try {
    cachedAuth = getReactNativePersistence
      ? FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
      : getAuth(app);
  } catch {
    // initializeAuth throws if Auth already exists for this app (for example after a fast refresh).
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

/** Native modules are loaded on use, so Expo Go and tests (which lack them) still start. */
function loadAppleModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-apple-authentication") as typeof import("expo-apple-authentication");
  } catch {
    return null;
  }
}
function loadGoogleModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
}

function createFirebaseBackend(): AuthBackend {
  let googleConfigured = false;
  return {
    configured: true,
    googleAvailable: Boolean(googleWebClientId) && Platform.OS !== "web",
    async appleAvailable() {
      if (Platform.OS !== "ios") return false;
      const apple = loadAppleModule();
      return apple ? apple.isAvailableAsync().catch(() => false) : false;
    },
    subscribe(listener) {
      // onIdTokenChanged also fires when a profile name is added after Apple sign-in.
      return onIdTokenChanged(firebaseAuth(), (user) => listener(toVoticUser(user)));
    },
    async createAccount(email, password) {
      await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    },
    async signIn(email, password) {
      await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    },
    async sendPasswordReset(email) {
      await sendPasswordResetEmail(firebaseAuth(), email.trim());
    },
    async signInWithApple() {
      const apple = loadAppleModule();
      if (!apple || !(await apple.isAvailableAsync().catch(() => false)))
        throw unavailable("Sign in with Apple isn't available on this device.");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Crypto = require("expo-crypto") as typeof import("expo-crypto");
      // Firebase checks that Apple signed the SHA-256 of this nonce, which stops a stolen token from being replayed.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      let result: Awaited<ReturnType<typeof apple.signInAsync>>;
      try {
        result = await apple.signInAsync({
          requestedScopes: [apple.AppleAuthenticationScope.FULL_NAME, apple.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        });
      } catch (error) {
        if ((error as { code?: string })?.code === "ERR_REQUEST_CANCELED") throw new SignInCancelled();
        throw error;
      }
      if (!result.identityToken) throw unavailable("Apple didn't return a sign-in token. Please try again.");
      const credential = new OAuthProvider("apple.com").credential({
        idToken: result.identityToken,
        rawNonce,
      });
      const signedIn = await signInWithCredential(firebaseAuth(), credential);
      // Apple shares the name only on the first sign-in, so keep it when it arrives.
      const name = [result.fullName?.givenName, result.fullName?.familyName].filter(Boolean).join(" ");
      if (name && !signedIn.user.displayName) await updateProfile(signedIn.user, { displayName: name });
    },
    async signInWithGoogle() {
      const google = loadGoogleModule();
      if (!google || !googleWebClientId)
        throw unavailable("Google sign-in needs the Votic app build. It isn't available in Expo Go.");
      if (!googleConfigured) {
        google.GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId });
        googleConfigured = true;
      }
      if (Platform.OS === "android")
        await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      let response: Awaited<ReturnType<typeof google.GoogleSignin.signIn>>;
      try {
        response = await google.GoogleSignin.signIn();
      } catch (error) {
        if (google.isErrorWithCode(error) && error.code === google.statusCodes.SIGN_IN_CANCELLED)
          throw new SignInCancelled();
        throw error;
      }
      if (!google.isSuccessResponse(response)) throw new SignInCancelled();
      const idToken = response.data.idToken;
      if (!idToken) throw unavailable("Google didn't return a sign-in token. Please try again.");
      await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(idToken));
    },
    async signOut() {
      await firebaseSignOut(firebaseAuth());
      // Also forget the Google account, so the next Google sign-in offers the account picker again.
      if (googleConfigured)
        await loadGoogleModule()
          ?.GoogleSignin.signOut()
          .catch(() => null);
    },
    async deleteAccount() {
      const user = firebaseAuth().currentUser;
      if (!user) return;
      await deleteUser(user);
      if (googleConfigured)
        await loadGoogleModule()
          ?.GoogleSignin.signOut()
          .catch(() => null);
    },
    async idToken() {
      return (await firebaseAuth().currentUser?.getIdToken()) ?? null;
    },
  };
}

function createUnconfiguredBackend(): AuthBackend {
  const notSetUp = () => Promise.reject(unavailable("Sign-in isn't set up in this build of Votic yet."));
  return {
    configured: false,
    googleAvailable: false,
    appleAvailable: async () => false,
    subscribe(listener) {
      listener(null);
      return () => {};
    },
    createAccount: notSetUp,
    signIn: notSetUp,
    sendPasswordReset: notSetUp,
    signInWithApple: notSetUp,
    signInWithGoogle: notSetUp,
    signOut: async () => {},
    deleteAccount: async () => {},
    idToken: async () => null,
  };
}

export function createAuthBackend(): AuthBackend {
  const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
  return configured ? createFirebaseBackend() : createUnconfiguredBackend();
}
