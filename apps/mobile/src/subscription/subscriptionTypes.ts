/**
 * Subscription state as Votic sees it. It always comes from the store via RevenueCat, never from a
 * locally saved "paid" flag, so a reinstall or a second device gets the same answer.
 */
export type EntitlementStatus =
  | "unknown" // not checked yet, or the check failed with nothing cached
  | "none" // never subscribed
  | "trial" // free trial running
  | "active" // paid and renewing
  | "cancelled-active" // cancelled, but paid through the end of the current period
  | "billing-issue" // renewal payment failed; the store's grace period still grants access
  | "expired"; // had a trial or subscription that has ended

export type Entitlement = {
  status: EntitlementStatus;
  /** When the current period (trial or paid) ends, if known. */
  expiresAt: number | null;
  /** Where the store lets the person manage or cancel, if the store provides it. */
  managementUrl: string | null;
  /** The store product that grants access (Google Play "subscription:base-plan"), used to switch billing. */
  productId?: string | null;
};

export type PeriodUnit = "day" | "week" | "month" | "year";
export type Period = { count: number; unit: PeriodUnit };

/** One purchasable plan, described entirely by the store's product data. */
export type SubscriptionPlan = {
  id: string;
  /** Exact store product identifier, used to match server-verified upgrade options. */
  productId?: string;
  /** Localized price from the store, e.g. "$4.99". */
  priceString: string;
  /** Numeric store price, used only for honest same-currency savings comparisons. */
  priceAmount?: number;
  currencyCode?: string;
  billingPeriod: Period | null;
  /** Eligible paid introductory phases, in charge order, using localized store prices. */
  introductoryPrices?: { priceString: string; period: Period; cycles: number }[];
  /** Free trial length from the store configuration, or null when the plan has no free trial. */
  trial: Period | null;
};

export type PurchaseOutcome =
  | { kind: "purchased"; entitlement: Entitlement }
  | { kind: "cancelled" }
  | { kind: "pending" }
  | { kind: "failed"; message: string };

/**
 * Tag on the Google Play offer (a "Developer determined" offer on the monthly base plan) that Votic shows to
 * someone about to delete their account. Also tag it rc-ignore-offer so the paywall never picks it by default.
 */
export const RETENTION_OFFER_TAG = "votic-retention";

/** A discount for staying, described entirely by the store: e.g. $7.99/month for 2 months, then $9.99/month. */
export type RetentionOffer = {
  /** The store's subscription option ("base-plan:offer"), used to claim it. */
  id: string;
  productId: string;
  offerPrice: string;
  offerPeriod: Period;
  /** How many discounted billing periods, e.g. 2 months. */
  offerCycles: number;
  regularPrice: string;
  regularPeriod: Period | null;
};

/** A one-time purchase of additional AI usage, described entirely by the store's product data. */
export type CreditProduct = { productId: string; title: string; priceString: string };

/** Credits are granted by Votic's server after the store confirms the purchase, never by this outcome. */
export type CreditPurchaseOutcome =
  { kind: "purchased" } | { kind: "cancelled" } | { kind: "pending" } | { kind: "failed"; message: string };

/** Why subscriptions can't be offered in this build; shown instead of a fake purchase button. */
export type SubscriptionUnavailableReason = "not-configured" | "expo-go" | "unsupported-platform";

export interface SubscriptionService {
  readonly unavailableReason: SubscriptionUnavailableReason | null;
  /** Links the store purchases to the Votic account (Firebase uid), so they follow the person across devices. */
  identify(userId: string): Promise<Entitlement>;
  /** Forgets the account on this device. The subscription itself stays with the account. */
  reset(): Promise<void>;
  refresh(): Promise<Entitlement>;
  getPlans(): Promise<SubscriptionPlan[]>;
  /** Read upgrade products independently of the onboarding offering. Never starts a purchase. */
  getUpgradePlans?(productIds: string[]): Promise<SubscriptionPlan[]>;
  purchase(planId: string): Promise<PurchaseOutcome>;
  /**
   * Replaces the current subscription with another Votic Plus billing period through the store's own change
   * flow (never a second subscription). The store shows the final price, proration and timing first.
   */
  changePlan?(planId: string, fromProductId: string): Promise<PurchaseOutcome>;
  /**
   * The store's discount for staying on the person's current plan (a monthly subscriber gets the monthly
   * discount, an annual subscriber the annual one), if one is set up and this account is eligible; otherwise
   * null. Without a current plan, the first discount set up is offered.
   */
  getRetentionOffer?(currentProductId?: string | null): Promise<RetentionOffer | null>;
  /**
   * Claims the discount through the store's own purchase sheet. A current subscriber keeps their plan and moves
   * onto the discounted price at their next renewal, so nobody pays twice for the same period.
   */
  claimRetentionOffer?(offerId: string, fromProductId: string | null): Promise<PurchaseOutcome>;
  /** Store products for additional AI usage, limited to the IDs Votic's server is configured to credit. */
  getCreditProducts?(productIds: string[]): Promise<CreditProduct[]>;
  purchaseCredits?(productId: string): Promise<CreditPurchaseOutcome>;
  restore(): Promise<Entitlement>;
  /** Called whenever the store reports a change (renewal, expiry, refund). Returns an unsubscribe function. */
  onChange(listener: (entitlement: Entitlement, userId: string) => void): () => void;
}

export const UNKNOWN_ENTITLEMENT: Entitlement = { status: "unknown", expiresAt: null, managementUrl: null };

export const unavailable_subscription_service = (
  reason: SubscriptionUnavailableReason,
): SubscriptionService => ({
  unavailableReason: reason,
  async identify() {
    return UNKNOWN_ENTITLEMENT;
  },
  async reset() {},
  async refresh() {
    return UNKNOWN_ENTITLEMENT;
  },
  async getPlans() {
    return [];
  },
  async purchase() {
    return { kind: "failed", message: "Subscriptions aren't available in this version of Votic yet." };
  },
  async restore() {
    return UNKNOWN_ENTITLEMENT;
  },
  onChange() {
    return () => {};
  },
});
