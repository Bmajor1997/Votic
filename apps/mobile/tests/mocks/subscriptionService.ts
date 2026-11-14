import type { LegalLinks } from "../../src/config/appConfig";
import {
  CreditProduct,
  CreditPurchaseOutcome,
  Entitlement,
  FounderOffer,
  FounderProduct,
  PurchaseOutcome,
  RetentionOffer,
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

export function entitlement_of(status: Entitlement["status"], extra: Partial<Entitlement> = {}): Entitlement {
  return { status, expiresAt: null, managementUrl: null, ...extra };
}

type ResetOptions = {
  unavailableReason?: SubscriptionUnavailableReason | null;
  plans?: SubscriptionPlan[] | Error;
  defaultEntitlement?: Entitlement;
  legal?: LegalLinks;
};

const listeners = new Set<(entitlement: Entitlement, userId: string) => void>();
const server = new Map<string, Entitlement>();
let currentUser: string | null = null;

export const fakeSubscriptions = {
  unavailableReason: null as SubscriptionUnavailableReason | null,
  plans: [TWO_WEEK_TRIAL_PLAN] as SubscriptionPlan[] | Error,
  /** What an account without a stored subscription has. */
  defaultEntitlement: entitlement_of("active") as Entitlement,
  /** How the next purchase ends; by default it starts the trial. */
  nextPurchase: null as PurchaseOutcome | null,
  restoreResult: null as Entitlement | null,
  /** Makes the next purchase or restore throw, like the store SDK failing unexpectedly. */
  throwNext: null as "purchase" | "restore" | null,
  legal: { termsUrl: null, privacyUrl: null } as LegalLinks,
  /** Additional-usage products the store returns; only IDs the server lists are requested. */
  creditProducts: [] as CreditProduct[],
  /** The store's discount for staying; null when none is set up. */
  retentionOffer: null as RetentionOffer | null,
  /** More discounts for staying, one per plan, e.g. a monthly and an annual offer. */
  retentionOffers: [] as RetentionOffer[],
  nextCreditPurchase: { kind: "purchased" } as CreditPurchaseOutcome,
  /** The founder lifetime offer Votic's server reports for the signed-in account, and the store's product. */
  founderOffer: null as FounderOffer | null,
  /** Votic's server lets this account in free as a beta tester. */
  beta: false,
  founderProduct: null as FounderProduct | null,
  calls: [] as string[],
  reset(options: ResetOptions = {}) {
    server.clear();
    listeners.clear();
    currentUser = null;
    fakeSubscriptions.calls.length = 0;
    fakeSubscriptions.unavailableReason = options.unavailableReason ?? null;
    fakeSubscriptions.plans = options.plans ?? [TWO_WEEK_TRIAL_PLAN];
    fakeSubscriptions.defaultEntitlement = options.defaultEntitlement ?? entitlement_of("active");
    fakeSubscriptions.legal = options.legal ?? { termsUrl: null, privacyUrl: null };
    fakeSubscriptions.nextPurchase = null;
    fakeSubscriptions.restoreResult = null;
    fakeSubscriptions.throwNext = null;
    fakeSubscriptions.creditProducts = [];
    fakeSubscriptions.retentionOffer = null;
    fakeSubscriptions.retentionOffers = [];
    fakeSubscriptions.nextCreditPurchase = { kind: "purchased" };
    fakeSubscriptions.founderOffer = null;
    fakeSubscriptions.beta = false;
    fakeSubscriptions.founderProduct = null;
  },
  /** The store reports a change (renewal, expiry, refund) for an account. */
  set_entitlement(userId: string, entitlement: Entitlement) {
    server.set(userId, entitlement);
    if (userId === currentUser) listeners.forEach((listener) => listener(entitlement, userId));
  },
  entitlement_for(userId: string) {
    return server.get(userId) ?? fakeSubscriptions.defaultEntitlement;
  },
};

function throw_if_requested(action: "purchase" | "restore") {
  if (fakeSubscriptions.throwNext !== action) return;
  fakeSubscriptions.throwNext = null;
  throw new Error("Native store module crashed: internal detail");
}

export function create_subscription_service(): SubscriptionService {
  const read = () => (currentUser ? fakeSubscriptions.entitlement_for(currentUser) : UNKNOWN_ENTITLEMENT);
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
    async get_founder_product(productId) {
      fakeSubscriptions.calls.push("getFounderProduct:" + productId);
      const product = fakeSubscriptions.founderProduct;
      return product?.productId === productId ? product : null;
    },
    async purchase_founder(productId) {
      fakeSubscriptions.calls.push("purchaseFounder:" + productId);
      const outcome = fakeSubscriptions.nextPurchase ?? {
        kind: "purchased",
        entitlement: entitlement_of("lifetime"),
      };
      fakeSubscriptions.nextPurchase = null;
      if (outcome.kind === "purchased" && currentUser) server.set(currentUser, outcome.entitlement);
      return outcome;
    },
    async get_plans() {
      fakeSubscriptions.calls.push("getPlans");
      if (fakeSubscriptions.plans instanceof Error) throw fakeSubscriptions.plans;
      return fakeSubscriptions.plans;
    },
    async purchase(planId) {
      fakeSubscriptions.calls.push("purchase:" + planId);
      throw_if_requested("purchase");
      const outcome = fakeSubscriptions.nextPurchase ?? {
        kind: "purchased",
        entitlement: entitlement_of("trial", { expiresAt: Date.UTC(2026, 9, 15) }),
      };
      fakeSubscriptions.nextPurchase = null;
      if (outcome.kind === "purchased" && currentUser) server.set(currentUser, outcome.entitlement);
      return outcome;
    },
    async change_plan(planId, fromProductId) {
      fakeSubscriptions.calls.push(`changePlan:${planId}:from:${fromProductId}`);
      const outcome = fakeSubscriptions.nextPurchase ?? { kind: "purchased", entitlement: read() };
      fakeSubscriptions.nextPurchase = null;
      return outcome;
    },
    async get_retention_offer(currentProductId) {
      fakeSubscriptions.calls.push(
        currentProductId ? `getRetentionOffer:${currentProductId}` : "getRetentionOffer",
      );
      const offers = [fakeSubscriptions.retentionOffer, ...fakeSubscriptions.retentionOffers].filter(
        (offer): offer is RetentionOffer => Boolean(offer),
      );
      return (
        offers.find(
          (offer) =>
            !currentProductId ||
            offer.productId === currentProductId.split(":")[0] ||
            offer.productId === currentProductId,
        ) ?? null
      );
    },
    async claim_retention_offer(offerId, fromProductId) {
      fakeSubscriptions.calls.push(`claimRetentionOffer:${offerId}:from:${fromProductId}`);
      const outcome = fakeSubscriptions.nextPurchase ?? { kind: "purchased", entitlement: read() };
      fakeSubscriptions.nextPurchase = null;
      return outcome;
    },
    async get_credit_products(productIds) {
      fakeSubscriptions.calls.push("getCreditProducts:" + productIds.join(","));
      return fakeSubscriptions.creditProducts.filter((product) => productIds.includes(product.productId));
    },
    async purchase_credits(productId) {
      fakeSubscriptions.calls.push("purchaseCredits:" + productId);
      return fakeSubscriptions.nextCreditPurchase;
    },
    async restore() {
      fakeSubscriptions.calls.push("restore");
      throw_if_requested("restore");
      if (fakeSubscriptions.restoreResult && currentUser)
        server.set(currentUser, fakeSubscriptions.restoreResult);
      return read();
    },
    on_change(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function legal_links(): LegalLinks {
  return fakeSubscriptions.legal;
}
