import type { LegalLinks } from "../../src/config/appConfig";
import {
  Entitlement,
  PurchaseOutcome,
  SubscriptionPlan,
  SubscriptionService,
  SubscriptionUnavailableReason,
  UNKNOWN_ENTITLEMENT,
} from "../../src/subscription/subscriptionTypes";

/**
 * An in-memory stand-in for RevenueCat and the stores. Each account's subscription lives "on the server"
 * (this map), so signing out and back in, or a second device, sees the same answer. Accounts are
 * subscribed by default so screens past the paywall render; paywall tests call `fakeSubscriptions.reset`.
 */
export const TWO_WEEK_TRIAL_PLAN: SubscriptionPlan = {
  id: "$rc_monthly",
  priceString: "$9.99",
  billingPeriod: { count: 1, unit: "month" },
  trial: { count: 2, unit: "week" },
};

export function entitlementOf(status: Entitlement["status"], extra: Partial<Entitlement> = {}): Entitlement {
  return { status, expiresAt: null, managementUrl: null, ...extra };
}

type ResetOptions = {
  unavailableReason?: SubscriptionUnavailableReason | null;
  plans?: SubscriptionPlan[] | Error;
  defaultEntitlement?: Entitlement;
  legal?: LegalLinks;
};

const listeners = new Set<(entitlement: Entitlement) => void>();
const server = new Map<string, Entitlement>();
let currentUser: string | null = null;

export const fakeSubscriptions = {
  unavailableReason: null as SubscriptionUnavailableReason | null,
  plans: [TWO_WEEK_TRIAL_PLAN] as SubscriptionPlan[] | Error,
  /** What an account without a stored subscription has. */
  defaultEntitlement: entitlementOf("active") as Entitlement,
  /** How the next purchase ends; by default it starts the trial. */
  nextPurchase: null as PurchaseOutcome | null,
  restoreResult: null as Entitlement | null,
  legal: { termsUrl: null, privacyUrl: null } as LegalLinks,
  calls: [] as string[],
  reset(options: ResetOptions = {}) {
    server.clear();
    listeners.clear();
    currentUser = null;
    fakeSubscriptions.calls.length = 0;
    fakeSubscriptions.unavailableReason = options.unavailableReason ?? null;
    fakeSubscriptions.plans = options.plans ?? [TWO_WEEK_TRIAL_PLAN];
    fakeSubscriptions.defaultEntitlement = options.defaultEntitlement ?? entitlementOf("active");
    fakeSubscriptions.legal = options.legal ?? { termsUrl: null, privacyUrl: null };
    fakeSubscriptions.nextPurchase = null;
    fakeSubscriptions.restoreResult = null;
  },
  /** The store reports a change (renewal, expiry, refund) for an account. */
  setEntitlement(userId: string, entitlement: Entitlement) {
    server.set(userId, entitlement);
    if (userId === currentUser) listeners.forEach((listener) => listener(entitlement));
  },
  entitlementFor(userId: string) {
    return server.get(userId) ?? fakeSubscriptions.defaultEntitlement;
  },
};

export function createSubscriptionService(): SubscriptionService {
  const read = () => (currentUser ? fakeSubscriptions.entitlementFor(currentUser) : UNKNOWN_ENTITLEMENT);
  return {
    get unavailableReason() {
      return fakeSubscriptions.unavailableReason;
    },
    async identify(userId) {
      fakeSubscriptions.calls.push("identify:" + userId);
      currentUser = userId;
      return read();
    },
    async reset() {
      fakeSubscriptions.calls.push("reset");
      currentUser = null;
    },
    async refresh() {
      return read();
    },
    async getPlans() {
      fakeSubscriptions.calls.push("getPlans");
      if (fakeSubscriptions.plans instanceof Error) throw fakeSubscriptions.plans;
      return fakeSubscriptions.plans;
    },
    async purchase(planId) {
      fakeSubscriptions.calls.push("purchase:" + planId);
      const outcome = fakeSubscriptions.nextPurchase ?? {
        kind: "purchased",
        entitlement: entitlementOf("trial", { expiresAt: Date.UTC(2026, 9, 15) }),
      };
      fakeSubscriptions.nextPurchase = null;
      if (outcome.kind === "purchased" && currentUser) server.set(currentUser, outcome.entitlement);
      return outcome;
    },
    async restore() {
      fakeSubscriptions.calls.push("restore");
      if (fakeSubscriptions.restoreResult && currentUser)
        server.set(currentUser, fakeSubscriptions.restoreResult);
      return read();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function legalLinks(): LegalLinks {
  return fakeSubscriptions.legal;
}
