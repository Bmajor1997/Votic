import {
  Entitlement,
  EntitlementStatus,
  Period,
  PeriodUnit,
  PurchaseOutcome,
  SubscriptionPlan,
} from "./subscriptionTypes";

/** The parts of RevenueCat's CustomerInfo that decide access. Kept structural so tests need no native module. */
export type CustomerInfoLike = {
  entitlements: {
    active: Record<string, EntitlementInfoLike | undefined>;
    all: Record<string, EntitlementInfoLike | undefined>;
  };
  managementURL: string | null;
};
type EntitlementInfoLike = {
  isActive: boolean;
  willRenew: boolean;
  periodType: string;
  expirationDateMillis: number | null;
  billingIssueDetectedAt: string | null;
};

export function entitlementFromCustomerInfo(info: CustomerInfoLike, entitlementId: string): Entitlement {
  const active = info.entitlements.active[entitlementId];
  const any = active || info.entitlements.all[entitlementId];
  let status: EntitlementStatus;
  if (active?.isActive) {
    if (active.billingIssueDetectedAt) status = "billing-issue";
    else if (active.periodType === "TRIAL") status = "trial";
    else if (!active.willRenew) status = "cancelled-active";
    else status = "active";
  } else status = any ? "expired" : "none";
  return { status, expiresAt: any?.expirationDateMillis ?? null, managementUrl: info.managementURL };
}

/** Only these states let someone into paid Votic. "unknown" never does. */
export function hasAccess(status: EntitlementStatus) {
  return (
    status === "trial" || status === "active" || status === "cancelled-active" || status === "billing-issue"
  );
}

/** RevenueCat error codes (PURCHASES_ERROR_CODE) that the paywall treats specially. */
const CANCELLED = "1",
  STORE_PROBLEM = "2",
  NETWORK = "10",
  PENDING = "20";

export function purchaseOutcomeFromError(error: unknown): PurchaseOutcome {
  const { code, userCancelled } = (error || {}) as { code?: string; userCancelled?: boolean | null };
  if (userCancelled || code === CANCELLED) return { kind: "cancelled" };
  if (code === PENDING) return { kind: "pending" };
  if (code === NETWORK)
    return {
      kind: "failed",
      message: "Votic couldn't reach the store. Check your connection and try again.",
    };
  if (code === STORE_PROBLEM)
    return {
      kind: "failed",
      message:
        "The store had a problem completing your purchase. You weren't charged. Try again in a moment.",
    };
  return {
    kind: "failed",
    message: "Your purchase couldn't be completed. You weren't charged. Please try again.",
  };
}

const UNITS: Record<string, PeriodUnit> = {
  D: "day",
  W: "week",
  M: "month",
  Y: "year",
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
};

/** Parses ISO 8601 store periods such as "P1M", "P7D", "P2W", or "P1Y". */
export function parseIsoPeriod(value: string | null | undefined): Period | null {
  const match = /^P(\d+)([DWMY])$/i.exec(value?.trim() || "");
  if (!match) return null;
  const count = Number(match[1]);
  return count > 0 ? { count, unit: UNITS[match[2].toUpperCase()] } : null;
}

/** The parts of RevenueCat's StoreProduct that describe price and trial. */
export type StoreProductLike = {
  identifier: string;
  priceString: string;
  subscriptionPeriod: string | null;
  introPrice: { price: number; periodUnit: string; periodNumberOfUnits: number; cycles: number } | null;
  freePhase?: { billingPeriod: { unit: string; value: number }; billingCycleCount: number | null } | null;
};

/**
 * Reads the free trial from the store product. iOS reports it as a free introductory price; Google Play
 * reports it as a free pricing phase. Anything that isn't free (e.g. a discounted first month) is not a trial.
 */
export function planFromStoreProduct(packageId: string, product: StoreProductLike): SubscriptionPlan {
  let trial: Period | null = null;
  const intro = product.introPrice;
  if (intro && intro.price === 0 && UNITS[intro.periodUnit] && intro.periodNumberOfUnits > 0)
    trial = {
      count: intro.periodNumberOfUnits * Math.max(1, intro.cycles || 1),
      unit: UNITS[intro.periodUnit],
    };
  const free = product.freePhase;
  if (!trial && free && UNITS[free.billingPeriod.unit] && free.billingPeriod.value > 0)
    trial = {
      count: free.billingPeriod.value * Math.max(1, free.billingCycleCount || 1),
      unit: UNITS[free.billingPeriod.unit],
    };
  return {
    id: packageId,
    priceString: product.priceString,
    billingPeriod: parseIsoPeriod(product.subscriptionPeriod),
    trial,
  };
}
