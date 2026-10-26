import { describe, expect, it } from "vitest";
import {
  CustomerInfoLike,
  entitlement_from_customer_info,
  has_access,
  parse_iso_period,
  plan_from_store_product,
  purchase_outcome_from_error,
} from "./entitlement";

function info(
  pro: Partial<CustomerInfoLike["entitlements"]["active"][string]> | null,
  active = true,
): CustomerInfoLike {
  const entitlement = pro && {
    isActive: active,
    willRenew: true,
    periodType: "NORMAL",
    expirationDateMillis: 1_800_000_000_000,
    billingIssueDetectedAt: null,
    ...pro,
  };
  return {
    entitlements: {
      active: active && entitlement ? { pro: entitlement } : {},
      all: entitlement ? { pro: entitlement } : {},
    },
    managementURL: "https://apps.apple.com/account/subscriptions",
  };
}

describe("subscription status from RevenueCat", () => {
  it("reads each state", () => {
    expect(entitlement_from_customer_info(info({ periodType: "TRIAL" }), "pro").status).toBe("trial");
    expect(entitlement_from_customer_info(info({}), "pro").status).toBe("active");
    expect(entitlement_from_customer_info(info({ willRenew: false }), "pro").status).toBe("cancelled-active");
    expect(entitlement_from_customer_info(info({ billingIssueDetectedAt: "2026-10-01" }), "pro").status).toBe(
      "billing-issue",
    );
    expect(entitlement_from_customer_info(info({}, false), "pro").status).toBe("expired");
    expect(entitlement_from_customer_info(info(null), "pro").status).toBe("none");
  });
  it("only grants access while the store says the entitlement is active", () => {
    expect(
      ["trial", "active", "cancelled-active", "billing-issue"].every((status) => has_access(status as never)),
    ).toBe(true);
    expect(["none", "expired", "unknown"].some((status) => has_access(status as never))).toBe(false);
  });
  it("ignores other entitlements", () => {
    expect(entitlement_from_customer_info(info({}), "votic_plus").status).toBe("none");
  });
});

describe("purchase errors", () => {
  it("distinguishes cancelled, pending, network, and other failures", () => {
    expect(purchase_outcome_from_error({ code: "1", userCancelled: true })).toEqual({ kind: "cancelled" });
    expect(purchase_outcome_from_error({ code: "20" })).toEqual({ kind: "pending" });
    expect(purchase_outcome_from_error({ code: "10" })).toMatchObject({
      kind: "failed",
      message: expect.stringMatching(/connection/),
    });
    expect(purchase_outcome_from_error(new Error("boom"))).toMatchObject({
      kind: "failed",
      message: expect.stringMatching(/Restore Purchases/),
    });
  });
});

describe("plans from store products", () => {
  const base = {
    identifier: "votic_monthly",
    priceString: "$4.99",
    subscriptionPeriod: "P1M",
    introPrice: null,
  };
  it("reads an App Store free trial", () => {
    expect(
      plan_from_store_product("$rc_monthly", {
        ...base,
        introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 7, cycles: 1 },
      }),
    ).toEqual({
      id: "$rc_monthly",
      productId: "votic_monthly",
      priceString: "$4.99",
      billingPeriod: { count: 1, unit: "month" },
      trial: { count: 7, unit: "day" },
    });
  });
  it("reads a Google Play free trial phase", () => {
    expect(
      plan_from_store_product("$rc_monthly", {
        ...base,
        freePhase: { billingPeriod: { unit: "WEEK", value: 2 }, billingCycleCount: 1 },
      }).trial,
    ).toEqual({ count: 2, unit: "week" });
  });
  it("doesn't call a paid introductory price a free trial", () => {
    expect(
      plan_from_store_product("$rc_monthly", {
        ...base,
        introPrice: { price: 0.99, periodUnit: "MONTH", periodNumberOfUnits: 1, cycles: 1 },
      }).trial,
    ).toBeNull();
  });
  it("parses store periods", () => {
    expect(parse_iso_period("P1Y")).toEqual({ count: 1, unit: "year" });
    expect(parse_iso_period("P14D")).toEqual({ count: 14, unit: "day" });
    expect(parse_iso_period("monthly")).toBeNull();
  });
});

it("preserves store-localized paid introductory phases without calling them free", () => {
  const base = { identifier: "monthly", priceString: "9,99 €", subscriptionPeriod: "P1M", introPrice: null };
  const apple = plan_from_store_product("month", {
    ...base,
    introPrice: {
      price: 0.99,
      priceString: "0,99 €",
      periodUnit: "MONTH",
      periodNumberOfUnits: 1,
      cycles: 3,
    },
  });
  const google = plan_from_store_product("month", {
    ...base,
    introPhases: [
      {
        price: { amountMicros: 990000, formatted: "0,99 €" },
        billingPeriod: { value: 1, unit: "MONTH" },
        billingCycleCount: 3,
      },
    ],
  });
  for (const plan of [apple, google]) {
    expect(plan.trial).toBeNull();
    expect(plan.introductoryPrices).toEqual([
      { priceString: "0,99 €", period: { count: 1, unit: "month" }, cycles: 3 },
    ]);
  }
});

it("never promises a charge was absent after an uncertain purchase error", () => {
  for (const code of ["2", "99", undefined]) {
    const outcome = purchase_outcome_from_error({ code });
    expect(outcome.kind).toBe("failed");
    if (outcome.kind === "failed") {
      expect(outcome.message).not.toMatch(/weren't charged/);
      expect(outcome.message).toMatch(/Restore Purchases/);
    }
  }
});

describe("the product that grants access", () => {
  const entitlement = {
    isActive: true,
    willRenew: true,
    periodType: "NORMAL",
    expirationDateMillis: 1,
    billingIssueDetectedAt: null,
  };
  it("names Google Play's subscription and base plan together, like store packages do", () => {
    const read = (extra: object) =>
      entitlement_from_customer_info(
        { entitlements: { active: { pro: { ...entitlement, ...extra } }, all: {} }, managementURL: null },
        "pro",
      ).productId;
    expect(read({ productIdentifier: "votic_plus", productPlanIdentifier: "annual" })).toBe(
      "votic_plus:annual",
    );
    expect(read({ productIdentifier: "votic_plus_monthly", productPlanIdentifier: null })).toBe(
      "votic_plus_monthly",
    );
    expect(read({})).toBeNull();
  });
});
