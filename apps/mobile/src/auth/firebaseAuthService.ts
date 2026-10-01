import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Auth, User } from "@firebase/auth";
import { FirebaseConfig } from "../config/appConfig";
import { AccountUser, AuthService } from "./authTypes";
import { authErrorFromCode, normalizeEmail } from "./authValidation";

// The React Native build of Firebase Auth exports this, but its public type file omits it.
declare module "@firebase/auth" {
  export function getReactNativePersistence(
    storage: typeof AsyncStorage,
  ): import("@firebase/auth").Persistence;
}

function toAccountUser(user: User): AccountUser {
  return {
    uid: user.uid,
    email: user.email || "",
    firstName: user.displayName || "",
    emailVerified: user.emailVerified,
  };
}

function rethrow(error: unknown): never {
  // Only the error code is used; Firebase error messages can include the email address.
  throw authErrorFromCode((error as { code?: string } | null)?.code);
}

/**
 * Email/password accounts through Firebase Authentication. Firebase stores password hashes, sends
 * verification and reset emails, and keeps the session (a refresh token) in the app's private storage.
 * Votic never stores or logs passwords.
 */
export function createFirebaseAuthService(config: FirebaseConfig): AuthService {
  let authPromise: Promise<{ auth: Auth; sdk: typeof import("@firebase/auth") }> | null = null;
  function load() {
    authPromise ??= (async () => {
      const [{ initializeApp, getApps, getApp }, sdk] = await Promise.all([
        import("@firebase/app"),
        import("@firebase/auth"),
      ]);
      const app = getApps().length ? getApp() : initializeApp(config);
      let auth: Auth;
      try {
        auth = sdk.initializeAuth(app, { persistence: sdk.getReactNativePersistence(AsyncStorage) });
      } catch {
        // Already initialized (e.g. after a fast refresh during development).
        auth = sdk.getAuth(app);
      }
      return { auth, sdk };
    })();
    return authPromise;
  }
  async function currentUser() {
    const { auth } = await load();
    return auth.currentUser;
  }

  return {
    available: true,
    methods: ["email"],
    subscribe(listener) {
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;
      void load().then(({ auth, sdk }) => {
        if (cancelled) return;
        unsubscribe = sdk.onIdTokenChanged(auth, (user) => listener(user ? toAccountUser(user) : null));
      });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },
    async createAccount({ firstName, email, password }) {
      const { auth, sdk } = await load();
      try {
        const { user } = await sdk.createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
        await sdk.updateProfile(user, { displayName: firstName.trim() });
        await sdk.sendEmailVerification(user).catch(() => {
          // The account exists either way; the verification screen offers "Resend".
        });
        await user.getIdToken(true);
        return toAccountUser(user);
      } catch (error) {
        rethrow(error);
      }
    },
    async signIn({ email, password }) {
      const { auth, sdk } = await load();
      try {
        const { user } = await sdk.signInWithEmailAndPassword(auth, normalizeEmail(email), password);
        return toAccountUser(user);
      } catch (error) {
        rethrow(error);
      }
    },
    async signOut() {
      const { auth, sdk } = await load();
      await sdk.signOut(auth);
    },
    async sendVerificationEmail() {
      const { sdk } = await load();
      const user = await currentUser();
      if (!user) return;
      try {
        await sdk.sendEmailVerification(user);
      } catch (error) {
        rethrow(error);
      }
    },
    async refreshUser() {
      const user = await currentUser();
      if (!user) return null;
      try {
        await user.reload();
        // A new ID token carries the updated email_verified claim and notifies subscribers.
        await user.getIdToken(true);
      } catch (error) {
        rethrow(error);
      }
      return toAccountUser(user);
    },
    async sendPasswordReset(email) {
      const { auth, sdk } = await load();
      try {
        await sdk.sendPasswordResetEmail(auth, normalizeEmail(email));
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        // Unknown emails are treated as success so the screen never reveals whether an account exists.
        if (code === "auth/user-not-found" || code === "auth/invalid-credential") return;
        rethrow(error);
      }
    },
    async deleteAccount(password) {
      const { sdk } = await load();
      const user = await currentUser();
      if (!user?.email) return;
      try {
        await sdk.reauthenticateWithCredential(user, sdk.EmailAuthProvider.credential(user.email, password));
        await sdk.deleteUser(user);
      } catch (error) {
        rethrow(error);
      }
    },
    async discardUnverifiedAccount() {
      const { auth, sdk } = await load();
      const user = auth.currentUser;
      if (!user) return;
      if (!user.emailVerified) {
        try {
          await sdk.deleteUser(user);
          return;
        } catch {
          // Deleting needs a recent sign-in; signing out still lets the person start over.
        }
      }
      await sdk.signOut(auth);
    },
  };
}
