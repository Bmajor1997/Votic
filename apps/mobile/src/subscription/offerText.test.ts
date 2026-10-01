import { describe, expect, it } from "vitest";
import {
  billingSummary,
  billingTerms,
  offerTitle,
  planName,
  primaryActionLabel,
  trialEndDate,
  trialTimeline,
} from "./offerText";
import { SubscriptionPlan } from "./subscriptionTypes";

const monthly = (trialDays: number | null, price = "$4.99"): SubscriptionPlan => ({
  id: "$rc_monthly",
  priceString: price,
  billingPeriod: { count: 1, unit: "month" },
  trial: trialDays ? { count: trialDays, unit: "day" } : null,
});
const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const now = new Date("2026-10-01T12:00:00Z");

describe("paywall wording follows the store's product configuration", () => {
  it("describes a 7-day trial", () => {
    expect(billingSummary(monthly(7))).toBe("7 days free, then $4.99/month. Cancel anytime.");
    expect(primaryActionLabel(monthly(7))).toBe("Start free trial");
  });
  it("describes a 14-day trial when that's what is configured", () => {
    expect(billingSummary(monthly(14, "$6.99"))).toBe("14 days free, then $6.99/month. Cancel anytime.");
    expect(billingTerms(monthly(14, "$6.99"), { now, store: "App Store", formatDate })).toBe(
      "Your 14-day free trial starts today. You won't be charged until it ends on 2026-10-15. " +
        "Your subscription renews automatically at $6.99 per month until you cancel. " +
        "Cancel anytime in your App Store subscription settings at least 24 hours before your trial ends to avoid being charged.",
    );
  });
  it("offers a plain subscription when no trial is configured", () => {
    expect(primaryActionLabel(monthly(null))).toBe("Subscribe for $4.99/month");
    expect(offerTitle(monthly(null))).toBe("Get Votic Premium");
    expect(trialTimeline(monthly(null), { now, formatDate })).toEqual([]);
    expect(billingSummary(monthly(null))).toBe("$4.99/month. Cancel anytime.");
    expect(billingTerms(monthly(null), { now, store: "Google Play", formatDate })).toMatch(
      /^You'll be charged \$4\.99 when you subscribe\. .* Google Play .* before it renews/,
    );
  });
  it("describes a two-week trial reported by the store in weeks, with a timeline", () => {
    const plan: SubscriptionPlan = { ...monthly(null, "$9.99"), trial: { count: 2, unit: "week" } };
    expect(offerTitle(plan)).toBe("Try Votic Premium free for 2 weeks");
    expect(billingSummary(plan)).toBe("2 weeks free, then $9.99/month. Cancel anytime.");
    expect(trialTimeline(plan, { now, formatDate })).toEqual([
      { when: "Today", what: "Your free trial starts. Get everything in Votic Premium." },
      {
        when: "2026-10-15",
        what: "Your subscription starts at $9.99/month. Cancel at least a day before and you won't be charged.",
      },
    ]);
  });
  it("names plans by billing period", () => {
    expect(planName(monthly(7))).toBe("Monthly");
    expect(planName({ ...monthly(null), billingPeriod: { count: 1, unit: "year" } })).toBe("Yearly");
  });
  it("counts week trials in days and month trials on the calendar", () => {
    expect(formatDate(trialEndDate({ count: 1, unit: "week" }, now))).toBe("2026-10-08");
    expect(formatDate(trialEndDate({ count: 1, unit: "month" }, now))).toBe("2026-11-01");
  });
});
