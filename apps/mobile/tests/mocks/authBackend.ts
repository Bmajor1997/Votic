import type { AuthBackend, VoticUser } from "../../src/auth/authBackend";

/** An in-memory stand-in for Firebase. Tests start signed in unless they call fakeAuth.reset(null). */
const listeners = new Set<(user: VoticUser | null) => void>();
const SIGNED_IN: VoticUser = { uid: "test-user", email: "reader@example.com", displayName: "Sam Reader" };

export const fakeAuth = {
  user: SIGNED_IN as VoticUser | null,
  accounts: new Map<string, string>(),
  calls: [] as string[],
  /** Whether Apple and Google sign-ins create a new account (true) or sign in to an existing one. */
  socialCreatesAccount: true,
  /** False behaves like a build without Firebase settings, where development builds can be explored. */
  configured: true,
  googleAvailable: true,
  /** What Continue with Google throws, as the real backend does when it can't finish (null: it succeeds). */
  googleFailure: null as Error | null,
  /** Holds Continue with Google open until released, to observe its busy state. */
  googlePending: null as Promise<void> | null,
  reset(user: VoticUser | null = SIGNED_IN) {
    fakeAuth.user = user;
    fakeAuth.configured = true;
    fakeAuth.googleAvailable = true;
    fakeAuth.googleFailure = null;
    fakeAuth.googlePending = null;
    fakeAuth.accounts.clear();
    fakeAuth.calls.length = 0;
    fakeAuth.socialCreatesAccount = true;
    listeners.clear();
  },
  set_user(user: VoticUser | null) {
    fakeAuth.user = user;
    listeners.forEach((listener) => listener(user));
  },
};

function failure(code: string) {
  return Object.assign(new Error(code), { code });
}

export function create_auth_backend(): AuthBackend {
  return {
    configured: fakeAuth.configured,
    googleAvailable: fakeAuth.googleAvailable,
    apple_available: async () => true,
    subscribe(listener) {
      listeners.add(listener);
      listener(fakeAuth.user);
      return () => listeners.delete(listener);
    },
    async create_account(email, password) {
      fakeAuth.calls.push("createAccount");
      if (fakeAuth.accounts.has(email)) throw failure("auth/email-already-in-use");
      fakeAuth.accounts.set(email, password);
      fakeAuth.set_user({
        uid: "new-" + email,
        email,
        displayName: null,
        isNewAccount: true,
        passwordSignIn: true,
      });
    },
    async sign_in(email, password) {
      fakeAuth.calls.push("signIn");
      if (fakeAuth.accounts.get(email) !== password) throw failure("auth/invalid-credential");
      fakeAuth.set_user({ uid: "user-" + email, email, displayName: null, passwordSignIn: true });
    },
    async send_password_reset() {
      fakeAuth.calls.push("sendPasswordReset");
    },
    async sign_in_with_apple() {
      fakeAuth.calls.push("signInWithApple");
      fakeAuth.set_user({
        uid: "apple",
        email: null,
        displayName: "Apple Reader",
        isNewAccount: fakeAuth.socialCreatesAccount,
      });
    },
    async sign_in_with_google() {
      fakeAuth.calls.push("signInWithGoogle");
      if (fakeAuth.googlePending) await fakeAuth.googlePending;
      if (fakeAuth.googleFailure) throw fakeAuth.googleFailure;
      fakeAuth.set_user({
        uid: "google",
        email: "g@example.com",
        displayName: "Google Reader",
        isNewAccount: fakeAuth.socialCreatesAccount,
      });
    },
    async sign_out() {
      fakeAuth.calls.push("signOut");
      fakeAuth.set_user(null);
    },
    async delete_account() {
      fakeAuth.calls.push("deleteAccount");
      fakeAuth.set_user(null);
    },
    prepare_delete_account: async () => {},
    idToken: async () => (fakeAuth.user ? "test-token" : null),
  };
}
