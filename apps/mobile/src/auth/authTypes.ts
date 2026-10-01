/** The signed-in person, as the rest of Votic sees them. Never holds passwords or tokens. */
export type AccountUser = { uid: string; email: string; firstName: string; emailVerified: boolean };

/**
 * Ways to sign in. Only "email" exists today.
 * Google and Apple will be added here ("google" | "apple"), each with a service method
 * (e.g. signInWithGoogle) and a button on the Welcome screen — see apps/mobile/docs/ACCOUNTS_AND_SUBSCRIPTIONS.md.
 */
export type AuthMethod = "email";

/** A sign-in failure with a message that is safe to show: it never reveals whether an account exists. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "invalid-credentials"
      | "email-in-use"
      | "weak-password"
      | "invalid-email"
      | "too-many-requests"
      | "network"
      | "requires-recent-login"
      | "unavailable"
      | "unknown",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthService {
  /** False when this build has no account configuration; the app says so instead of pretending. */
  readonly available: boolean;
  readonly methods: AuthMethod[];
  /** Calls the listener with the current user now and whenever it changes. Returns an unsubscribe function. */
  subscribe(listener: (user: AccountUser | null) => void): () => void;
  createAccount(input: { firstName: string; email: string; password: string }): Promise<AccountUser>;
  signIn(input: { email: string; password: string }): Promise<AccountUser>;
  signOut(): Promise<void>;
  sendVerificationEmail(): Promise<void>;
  /** Re-reads the account from the server, e.g. to see whether the email has been verified. */
  refreshUser(): Promise<AccountUser | null>;
  sendPasswordReset(email: string): Promise<void>;
  /** Permanently deletes the account after confirming the password. Local documents stay on the device. */
  deleteAccount(password: string): Promise<void>;
  /**
   * For "Use a different email" on the verification screen: removes a just-created account whose email
   * was never verified, so a mistyped address doesn't keep an account. Falls back to signing out.
   */
  discardUnverifiedAccount(): Promise<void>;
}

/** The service used when a build has no Firebase configuration. Every action explains that accounts are off. */
export const unavailableAuthService: AuthService = {
  available: false,
  methods: [],
  subscribe(listener) {
    listener(null);
    return () => {};
  },
  async createAccount() {
    throw new AuthError(ACCOUNTS_UNAVAILABLE_MESSAGE, "unavailable");
  },
  async signIn() {
    throw new AuthError(ACCOUNTS_UNAVAILABLE_MESSAGE, "unavailable");
  },
  async signOut() {},
  async sendVerificationEmail() {
    throw new AuthError(ACCOUNTS_UNAVAILABLE_MESSAGE, "unavailable");
  },
  async refreshUser() {
    return null;
  },
  async sendPasswordReset() {
    throw new AuthError(ACCOUNTS_UNAVAILABLE_MESSAGE, "unavailable");
  },
  async deleteAccount() {
    throw new AuthError(ACCOUNTS_UNAVAILABLE_MESSAGE, "unavailable");
  },
  async discardUnverifiedAccount() {},
};

export const ACCOUNTS_UNAVAILABLE_MESSAGE = "Votic accounts aren't set up in this version of the app yet.";
