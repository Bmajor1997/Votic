import { describe, expect, it } from "vitest";
import {
  CustomerInfoLike,
  entitlementFromCustomerInfo,
  hasAccess,
  parseIsoPeriod,
  planFromStoreProduct,
  purchaseOutcomeFromError,
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
    expect(entitlementFromCustomerInfo(info({ periodType: "TRIAL" }), "pro").status).toBe("trial");
    expect(entitlementFromCustomerInfo(info({}), "pro").status).toBe("active");
    expect(entitlementFromCustomerInfo(info({ willRenew: false }), "pro").status).toBe("cancelled-active");
    expect(entitlementFromCustomerInfo(info({ billingIssueDetectedAt: "2026-10-01" }), "pro").status).toBe(
      "billing-issue",
    );
    expect(entitlementFromCustomerInfo(info({}, false), "pro").status).toBe("expired");
    expect(entitlementFromCustomerInfo(info(null), "pro").status).toBe("none");
  });
  it("only grants access while the store says the entitlement is active", () => {
    expect(
      ["trial", "active", "cancelled-active", "billing-issue"].every((status) => hasAccess(status as never)),
    ).toBe(true);
    expect(["none", "expired", "unknown"].some((status) => hasAccess(status as never))).toBe(false);
  });
  it("ignores other entitlements", () => {
    expect(entitlementFromCustomerInfo(info({}), "votic_plus").status).toBe("none");
  });
});

describe("purchase errors", () => {
  it("distinguishes cancelled, pending, network, and other failures", () => {
    expect(purchaseOutcomeFromError({ code: "1", userCancelled: true })).toEqual({ kind: "cancelled" });
    expect(purchaseOutcomeFromError({ code: "20" })).toEqual({ kind: "pending" });
    expect(purchaseOutcomeFromError({ code: "10" })).toMatchObject({
      kind: "failed",
      message: expect.stringMatching(/connection/),
    });
    expect(purchaseOutcomeFromError(new Error("boom"))).toMatchObject({
      kind: "failed",
      message: expect.stringMatching(/weren't charged/),
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
      planFromStoreProduct("$rc_monthly", {
        ...base,
        introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 7, cycles: 1 },
      }),
    ).toEqual({
      id: "$rc_monthly",
      priceString: "$4.99",
      billingPeriod: { count: 1, unit: "month" },
      trial: { count: 7, unit: "day" },
    });
  });
  it("reads a Google Play free trial phase", () => {
    expect(
      planFromStoreProduct("$rc_monthly", {
        ...base,
        freePhase: { billingPeriod: { unit: "WEEK", value: 2 }, billingCycleCount: 1 },
      }).trial,
    ).toEqual({ count: 2, unit: "week" });
  });
  it("doesn't call a paid introductory price a free trial", () => {
    expect(
      planFromStoreProduct("$rc_monthly", {
        ...base,
        introPrice: { price: 0.99, periodUnit: "MONTH", periodNumberOfUnits: 1, cycles: 1 },
      }).trial,
    ).toBeNull();
  });
  it("parses store periods", () => {
    expect(parseIsoPeriod("P1Y")).toEqual({ count: 1, unit: "year" });
    expect(parseIsoPeriod("P14D")).toEqual({ count: 14, unit: "day" });
    expect(parseIsoPeriod("monthly")).toBeNull();
  });
});
