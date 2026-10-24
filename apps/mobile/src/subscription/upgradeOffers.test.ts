import { describe, expect, it } from "vitest";
import { upgrade_offers } from "./upgradeOffers";
import { allowance_notifier, subscribe_allowance_notice } from "./allowanceNotice";
import type { SubscriptionOptions } from "../api/voticApi";
import type { SubscriptionPlan } from "./subscriptionTypes";
const options: SubscriptionOptions = {
  current: { productId: "basic", name: "Basic", store: "play_store" },
  upgrades: [{ productId: "plus", name: "Plus", capacityMultiplier: 2 }],
};
const plan: SubscriptionPlan = {
  id: "package-plus",
  productId: "plus",
  priceString: "€14,99",
  billingPeriod: { count: 1, unit: "month" },
  trial: null,
};
describe("upgrade offers", () => {
  it("uses exact verified product and localized monthly store price", () => {
    expect(upgrade_offers(options, [plan], "android")[0].plan.priceString).toBe("€14,99");
    for (const invalid of [
      { productId: "other" },
      { billingPeriod: { count: 1, unit: "year" } },
      { billingPeriod: null },
      { priceString: "" },
    ])
      expect(upgrade_offers(options, [{ ...plan, ...invalid } as SubscriptionPlan], "android")).toEqual([]);
    for (const platform of ["ios", "web"]) expect(upgrade_offers(options, [plan], platform)).toEqual([]);
    expect(upgrade_offers({ current: null, upgrades: options.upgrades }, [plan], "android")).toEqual([]);
  });
  it("ignores stale requests and ordinary service, daily, and rate errors", () => {
    const notices: string[] = [];
    const stop = subscribe_allowance_notice((n) => notices.push(n.resetsAt));
    const oldRequest = allowance_notifier();
    stop();
    const stopNew = subscribe_allowance_notice((n) => notices.push("new:" + n.resetsAt));
    try {
      const result = { code: "AI_MONTHLY_ALLOWANCE", resetsAt: "2026-11-01T00:00:00.000Z" };
      oldRequest(result);
      expect(notices).toEqual([]);
      const current = allowance_notifier();
      for (const error of [
        {},
        { code: "RATE_LIMITED" },
        { code: "AI_DAILY_ALLOWANCE" },
        { code: "AI_MONTHLY_ALLOWANCE", resetsAt: "invalid" },
      ])
        current(error);
      expect(notices).toEqual([]);
      current(result);
      expect(notices).toEqual(["new:" + result.resetsAt]);
    } finally {
      stopNew();
    }
  });
});
