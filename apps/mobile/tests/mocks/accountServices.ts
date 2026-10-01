import { AccountUser, AuthService } from "../../src/auth/authTypes";
import { authErrorFromCode, normalizeEmail } from "../../src/auth/authValidation";
import { AppServices } from "../../src/config/appServices";
import {
  Entitlement,
  PurchaseOutcome,
  SubscriptionPlan,
  SubscriptionService,
  SubscriptionUnavailableReason,
  UNKNOWN_ENTITLEMENT,
} from "../../src/subscription/subscriptionTypes";

type Account = { uid: string; firstName: string; email: string; password: string; emailVerified: boolean };

/**
 * An in-memory stand-in for Firebase Auth that fails the way Firebase does (same error codes), so screens
 * are tested against realistic behavior without a network or real accounts.
 */
export function createFakeAuth({ signedIn }: { signedIn?: Partial<Account> } = {}) {
  const accounts = new Map<string, Account>();
  const listeners = new Set<(user: AccountUser | null) => void>();
  let current: Account | null = null;
  let nextId = 1;
  const calls = { verificationEmails: 0, resetEmails: [] as string[], signIns: 0, signUps: 0 };
  const view = (account: Account | null): AccountUser | null =>
    account && {
      uid: account.uid,
      email: account.email,
      firstName: account.firstName,
      emailVerified: account.emailVerified,
    };
  const emit = () => listeners.forEach((listener) => listener(view(current)));
  function add(input: Partial<Account> & { email: string }) {
    const account: Account = {
      uid: input.uid ?? `user-${nextId++}`,
      firstName: input.firstName ?? "Sam",
      password: input.password ?? "reading123",
      emailVerified: input.emailVerified ?? true,
      email: normalizeEmail(input.email),
    };
    accounts.set(account.email, account);
    return account;
  }
  if (signedIn) current = add({ email: "sam@example.com", ...signedIn });

  const service: AuthService = {
    available: true,
    methods: ["email"],
    subscribe(listener) {
      listeners.add(listener);
      listener(view(current));
      return () => listeners.delete(listener);
    },
    async createAccount({ firstName, email, password }) {
      calls.signUps += 1;
      if (accounts.has(normalizeEmail(email))) throw authErrorFromCode("auth/email-already-in-use");
      current = add({ firstName: firstName.trim(), email, password, emailVerified: false });
      calls.verificationEmails += 1;
      emit();
      return view(current)!;
    },
    async signIn({ email, password }) {
      calls.signIns += 1;
      const account = accounts.get(normalizeEmail(email));
      if (!account || account.password !== password) throw authErrorFromCode("auth/invalid-credential");
      current = account;
      emit();
      return view(current)!;
    },
    async signOut() {
      current = null;
      emit();
    },
    async sendVerificationEmail() {
      calls.verificationEmails += 1;
    },
    async refreshUser() {
      emit();
      return view(current);
    },
    async sendPasswordReset(email) {
      calls.resetEmails.push(normalizeEmail(email));
    },
    async deleteAccount(password) {
      if (!current) return;
      if (current.password !== password) throw authErrorFromCode("auth/invalid-credential");
      accounts.delete(current.email);
      current = null;
      emit();
    },
    async discardUnverifiedAccount() {
      if (current && !current.emailVerified) accounts.delete(current.email);
      current = null;
      emit();
    },
  };
  return {
    service,
    calls,
    add,
    /** Simulates opening the link in the verification email (the app still has to refresh to notice). */
    verify(email: string) {
      const account = accounts.get(normalizeEmail(email));
      if (account) account.emailVerified = true;
    },
    get currentUid() {
      return current?.uid ?? null;
    },
  };
}

export const MONTHLY_TRIAL_PLAN: SubscriptionPlan = {
  id: "$rc_monthly",
  priceString: "$4.99",
  billingPeriod: { count: 1, unit: "month" },
  trial: { count: 7, unit: "day" },
};

export function entitlementOf(status: Entitlement["status"], extra: Partial<Entitlement> = {}): Entitlement {
  return { status, expiresAt: null, managementUrl: null, ...extra };
}

/**
 * A stand-in for RevenueCat. Entitlements are stored per account id, like RevenueCat's server, so they
 * survive sign-out, reinstall, and signing in on another device.
 */
export function createFakeSubscriptions({
  unavailableReason = null,
  plans = [MONTHLY_TRIAL_PLAN],
  entitlements = {},
}: {
  unavailableReason?: SubscriptionUnavailableReason | null;
  plans?: SubscriptionPlan[];
  entitlements?: Record<string, Entitlement>;
} = {}) {
  const server = new Map(Object.entries(entitlements));
  const listeners = new Set<(entitlement: Entitlement) => void>();
  let currentUser: string | null = null;
  let nextPurchase: PurchaseOutcome | null = null;
  const calls = { purchases: 0, restores: 0, identifies: [] as string[], resets: 0 };
  const read = () => (currentUser ? (server.get(currentUser) ?? entitlementOf("none")) : UNKNOWN_ENTITLEMENT);
  const service: SubscriptionService = {
    unavailableReason,
    async identify(userId) {
      calls.identifies.push(userId);
      currentUser = userId;
      return read();
    },
    async reset() {
      calls.resets += 1;
      currentUser = null;
    },
    async refresh() {
      return read();
    },
    async getPlans() {
      return plans;
    },
    async purchase() {
      calls.purchases += 1;
      const outcome = nextPurchase ?? {
        kind: "purchased",
        entitlement: entitlementOf("trial", { expiresAt: Date.UTC(2026, 9, 8) }),
      };
      if (outcome.kind === "purchased" && currentUser) server.set(currentUser, outcome.entitlement);
      return outcome;
    },
    async restore() {
      calls.restores += 1;
      return read();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    service,
    calls,
    /** The next purchase ends this way (cancelled, pending, failed, or a specific entitlement). */
    setNextPurchase(outcome: PurchaseOutcome) {
      nextPurchase = outcome;
    },
    /** Changes the store's record for an account, e.g. a trial expiring or a purchase on another device. */
    setEntitlement(userId: string, entitlement: Entitlement) {
      server.set(userId, entitlement);
      if (userId === currentUser) listeners.forEach((listener) => listener(entitlement));
    },
  };
}

export function fakeServices(
  auth = createFakeAuth({ signedIn: {} }),
  subscriptions = createFakeSubscriptions({ unavailableReason: "not-configured" }),
): AppServices {
  return {
    auth: auth.service,
    subscriptions: subscriptions.service,
    legal: { termsUrl: null, privacyUrl: null },
  };
}
