import { describe, expect, it, vi } from "vitest";
import {
  notify_ai_usage_changed,
  parse_ai_usage,
  subscribe_ai_usage_changes,
  usage_reset_label,
} from "./aiUsage";
import { default_plan, other_billing_plan, plus_plans } from "./paywallPresentation";
import type { SubscriptionPlan } from "./subscriptionTypes";

const active = {
  status: "active",
  plan: { name: "Votic Plus" },
  monthly: {
    percentRemaining: 99,
    allowance: 1000,
    used: 10,
    remaining: 990,
    periodStart: "2026-10-03T10:00:00.000Z",
    periodEnd: "2026-11-03T10:00:00.000Z",
    resetsAt: "2026-11-03T10:00:00.000Z",
    billingPeriodVerified: true,
  },
  purchased: { remaining: 0 },
  purchaseProducts: ["votic_ai_100"],
};

describe("AI usage from the server", () => {
  it("keeps the server's percentage and dates, and drops what the screen doesn't show", () => {
    expect(parse_ai_usage(active)).toEqual({
      status: "active",
      plan: { name: "Votic Plus" },
      monthly: {
        percentRemaining: 99,
        periodEnd: "2026-11-03T10:00:00.000Z",
        resetsAt: "2026-11-03T10:00:00.000Z",
        billingPeriodVerified: true,
      },
      purchased: { remaining: 0 },
      purchaseProducts: ["votic_ai_100"],
    });
    for (const percent of [0, 100])
      expect(
        parse_ai_usage({ ...active, monthly: { ...active.monthly, percentRemaining: percent } }).monthly,
      ).toMatchObject({ percentRemaining: percent });
  });

  it("never guesses: malformed, out-of-range or missing values are an error", () => {
    for (const monthly of [
      { ...active.monthly, percentRemaining: 101 },
      { ...active.monthly, percentRemaining: -1 },
      { ...active.monthly, percentRemaining: 99.5 },
      { ...active.monthly, percentRemaining: "99" },
      { ...active.monthly, resetsAt: "soon" },
      null,
    ])
      expect(() => parse_ai_usage({ ...active, monthly })).toThrow(/couldn't read your AI usage/);
    expect(() => parse_ai_usage({ status: "unlimited" })).toThrow();
    expect(() => parse_ai_usage({})).toThrow();
  });

  it("reads not-subscribed and not-configured answers without inventing an allowance", () => {
    expect(
      parse_ai_usage({
        status: "not-subscribed",
        plan: null,
        monthly: null,
        purchased: { remaining: 0 },
        purchaseProducts: [],
      }),
    ).toEqual({
      status: "not-subscribed",
      plan: null,
      monthly: null,
      purchased: { remaining: 0 },
      purchaseProducts: [],
    });
    expect(parse_ai_usage({ status: "not-configured" })).toMatchObject({
      monthly: null,
      purchased: null,
      purchaseProducts: [],
    });
    expect(
      parse_ai_usage({ ...active, purchased: { remaining: -3 }, purchaseProducts: [5, "", "ok"] }),
    ).toMatchObject({
      purchased: null,
      purchaseProducts: ["ok"],
    });
  });

  it("says Renews for a verified billing period and Resets for a calendar-month fallback", () => {
    const monthly = parse_ai_usage(active).monthly!;
    expect(usage_reset_label(monthly)).toMatch(/^Renews November 3, 2026$/);
    expect(usage_reset_label({ ...monthly, billingPeriodVerified: false })).toMatch(/^Resets /);
  });

  it("tells open AI Usage screens when an AI request finishes, until they unsubscribe", () => {
    const listener = vi.fn();
    const stop = subscribe_ai_usage_changes(listener);
    notify_ai_usage_changed();
    stop();
    notify_ai_usage_changed();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("the Votic Plus offer", () => {
  const plan = (id: string, unit: "month" | "year" | "week", productId = id): SubscriptionPlan => ({
    id,
    productId,
    priceString: "$1",
    billingPeriod: { count: 1, unit },
    trial: null,
  });
  const month = plan("$rc_monthly", "month", "votic_plus:monthly");
  const year = plan("$rc_annual", "year", "votic_plus:annual");
  it("offers monthly and annual, never other packages, and preselects monthly", () => {
    expect(plus_plans([year, plan("week", "week"), month]).map((item) => item.id)).toEqual([
      "$rc_monthly",
      "$rc_annual",
    ]);
    expect(default_plan([year, month])?.id).toBe("$rc_monthly");
    expect(default_plan([year])?.id).toBe("$rc_annual");
    expect(plus_plans([plan("week", "week")]).map((item) => item.id)).toEqual(["week"]);
    expect(default_plan([])).toBeNull();
  });
  it("finds the other billing period for a subscriber, and nothing for an unknown product", () => {
    expect(other_billing_plan([month, year], "votic_plus:monthly")?.id).toBe("$rc_annual");
    expect(other_billing_plan([month, year], "votic_plus:annual")?.id).toBe("$rc_monthly");
    expect(other_billing_plan([month, year], "something_else")).toBeNull();
    expect(other_billing_plan([month], "votic_plus:monthly")).toBeNull();
    expect(other_billing_plan([month, year], null)).toBeNull();
  });
});
