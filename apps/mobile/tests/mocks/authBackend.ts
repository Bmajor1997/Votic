import type { AuthBackend, VoticUser } from "../../src/auth/authBackend";

/** An in-memory stand-in for Firebase. Tests start signed in unless they call fakeAuth.reset(null). */
const listeners = new Set<(user: VoticUser | null) => void>();
const SIGNED_IN: VoticUser = { uid: "test-user", email: "reader@example.com", displayName: "Sam Reader" };

export const fakeAuth = {
  user: SIGNED_IN as VoticUser | null,
  accounts: new Map<string, string>(),
  calls: [] as string[],
  reset(user: VoticUser | null = SIGNED_IN) {
    fakeAuth.user = user;
    fakeAuth.accounts.clear();
    fakeAuth.calls.length = 0;
    listeners.clear();
  },
  setUser(user: VoticUser | null) {
    fakeAuth.user = user;
    listeners.forEach((listener) => listener(user));
  },
};

function failure(code: string) {
  return Object.assign(new Error(code), { code });
}

export function createAuthBackend(): AuthBackend {
  return {
    configured: true,
    googleAvailable: true,
    appleAvailable: async () => true,
    subscribe(listener) {
      listeners.add(listener);
      listener(fakeAuth.user);
      return () => listeners.delete(listener);
    },
    async createAccount(email, password) {
      fakeAuth.calls.push("createAccount");
      if (fakeAuth.accounts.has(email)) throw failure("auth/email-already-in-use");
      fakeAuth.accounts.set(email, password);
      fakeAuth.setUser({ uid: "new-" + email, email, displayName: null });
    },
    async signIn(email, password) {
      fakeAuth.calls.push("signIn");
      if (fakeAuth.accounts.get(email) !== password) throw failure("auth/invalid-credential");
      fakeAuth.setUser({ uid: "user-" + email, email, displayName: null });
    },
    async sendPasswordReset() {
      fakeAuth.calls.push("sendPasswordReset");
    },
    async signInWithApple() {
      fakeAuth.calls.push("signInWithApple");
      fakeAuth.setUser({ uid: "apple", email: null, displayName: "Apple Reader" });
    },
    async signInWithGoogle() {
      fakeAuth.calls.push("signInWithGoogle");
      fakeAuth.setUser({ uid: "google", email: "g@example.com", displayName: "Google Reader" });
    },
    async signOut() {
      fakeAuth.calls.push("signOut");
      fakeAuth.setUser(null);
    },
    async deleteAccount() {
      fakeAuth.calls.push("deleteAccount");
      fakeAuth.setUser(null);
    },
    idToken: async () => (fakeAuth.user ? "test-token" : null),
  };
}
