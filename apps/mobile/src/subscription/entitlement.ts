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

export function entitlement_from_customer_info(info: CustomerInfoLike, entitlementId: string): Entitlement {
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
export function has_access(status: EntitlementStatus) {
  return (
    status === "trial" || status === "active" || status === "cancelled-active" || status === "billing-issue"
  );
}

/** RevenueCat error codes (PURCHASES_ERROR_CODE) that the paywall treats specially. */
const CANCELLED = "1",
  STORE_PROBLEM = "2",
  NETWORK = "10",
  PENDING = "20";

export function purchase_outcome_from_error(error: unknown): PurchaseOutcome {
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
      message: "The store had a problem confirming your purchase. Use Restore Purchases before trying again.",
    };
  return {
    kind: "failed",
    message: "Your purchase couldn't be confirmed. Use Restore Purchases before trying again.",
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
export function parse_iso_period(value: string | null | undefined): Period | null {
  const match = /^P(\d+)([DWMY])$/i.exec(value?.trim() || "");
  if (!match) return null;
  const count = Number(match[1]);
  return count > 0 ? { count, unit: UNITS[match[2].toUpperCase()] } : null;
}

/** The parts of RevenueCat's StoreProduct that describe price and trial. */
export type StoreProductLike = {
  identifier: string;
  priceString: string;
  price?: number;
  currencyCode?: string;
  subscriptionPeriod: string | null;
  introPrice: {
    price: number;
    priceString?: string;
    periodUnit: string;
    periodNumberOfUnits: number;
    cycles: number;
  } | null;
  introPhases?: {
    price: { formatted: string; amountMicros: number };
    billingPeriod: { unit: string; value: number };
    billingCycleCount: number | null;
  }[];
  freePhase?: { billingPeriod: { unit: string; value: number }; billingCycleCount: number | null } | null;
};

/**
 * Reads the free trial from the store product. iOS reports it as a free introductory price; Google Play
 * reports it as a free pricing phase. Anything that isn't free (e.g. a discounted first month) is not a trial.
 */
export function plan_from_store_product(packageId: string, product: StoreProductLike): SubscriptionPlan {
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
    productId: product.identifier,
    priceString: product.priceString,
    ...(typeof product.price === "number" &&
    Number.isFinite(product.price) &&
    product.price > 0 &&
    /^[A-Z]{3}$/.test(product.currencyCode ?? "")
      ? { priceAmount: product.price, currencyCode: product.currencyCode }
      : {}),
    billingPeriod: parse_iso_period(product.subscriptionPeriod),
    trial,
    ...paid_intro_prices(product),
  };
}

/** Normalize eligible, localized introductory charges separately from free-trial detection. */
function paid_intro_prices(product: StoreProductLike) {
  const intro = product.introPrice;
  const introductoryPrices: NonNullable<SubscriptionPlan["introductoryPrices"]> = [];
  if (
    intro &&
    intro.price > 0 &&
    intro.priceString &&
    UNITS[intro.periodUnit] &&
    intro.periodNumberOfUnits > 0 &&
    intro.cycles > 0
  )
    introductoryPrices.push({
      priceString: intro.priceString,
      period: { count: intro.periodNumberOfUnits, unit: UNITS[intro.periodUnit] },
      cycles: intro.cycles,
    });
  for (const phase of product.introPhases ?? []) {
    if (
      phase.price.amountMicros > 0 &&
      phase.price.formatted &&
      UNITS[phase.billingPeriod.unit] &&
      phase.billingPeriod.value > 0
    )
      introductoryPrices.push({
        priceString: phase.price.formatted,
        period: { count: phase.billingPeriod.value, unit: UNITS[phase.billingPeriod.unit] },
        cycles: Math.max(1, phase.billingCycleCount || 1),
      });
  }
  return introductoryPrices.length ? { introductoryPrices } : {};
}
