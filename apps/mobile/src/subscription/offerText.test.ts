import { describe, expect, it } from "vitest";
import {
  billing_summary,
  billing_terms,
  offer_title,
  plan_card_detail,
  plan_name,
  primary_action_label,
  price_sequence,
  trial_end_date,
  trial_timeline,
} from "./offerText";
import { SubscriptionPlan } from "./subscriptionTypes";

const monthly = (trialDays: number | null, price = "$4.99"): SubscriptionPlan => ({
  id: "$rc_monthly",
  priceString: price,
  billingPeriod: { count: 1, unit: "month" },
  trial: trialDays ? { count: trialDays, unit: "day" } : null,
});
const format_date = (date: Date) => date.toISOString().slice(0, 10);
const now = new Date("2026-10-01T12:00:00Z");

describe("paywall wording follows the store's product configuration", () => {
  it("describes a 7-day trial", () => {
    expect(billing_summary(monthly(7))).toBe("7 days free, then $4.99/month. Auto-renews. Cancel anytime.");
    expect(primary_action_label(monthly(7))).toBe("Start free trial");
  });
  it("describes a 14-day trial when that's what is configured", () => {
    expect(billing_summary(monthly(14, "$6.99"))).toBe(
      "14 days free, then $6.99/month. Auto-renews. Cancel anytime.",
    );
    expect(billing_terms(monthly(14, "$6.99"), { now, store: "App Store", formatDate: format_date })).toBe(
      "Your 14-day free trial starts when you subscribe. Estimated first charge: 2026-10-15, at $6.99/month. The store confirms the exact date and terms before purchase. " +
        "Your subscription renews automatically at $6.99 per month until you cancel. " +
        "Cancel anytime in your App Store subscription settings at least 24 hours before your trial ends to avoid being charged.",
    );
  });
  it("offers a plain subscription when no trial is configured", () => {
    expect(primary_action_label(monthly(null))).toBe("Subscribe for $4.99/month");
    expect(offer_title(monthly(null))).toBe("Get Votic Premium");
    expect(trial_timeline(monthly(null), { now, formatDate: format_date })).toEqual([]);
    expect(billing_summary(monthly(null))).toBe("$4.99/month. Auto-renews. Cancel anytime.");
    expect(billing_terms(monthly(null), { now, store: "Google Play", formatDate: format_date })).toMatch(
      /^You'll be charged \$4\.99 when you subscribe\. .* Google Play .* before it renews/,
    );
  });
  it("describes a two-week trial reported by the store in weeks, with a timeline", () => {
    const plan: SubscriptionPlan = { ...monthly(null, "$9.99"), trial: { count: 2, unit: "week" } };
    expect(offer_title(plan)).toBe("Try Votic Premium free for 2 weeks");
    expect(billing_summary(plan)).toBe("2 weeks free, then $9.99/month. Auto-renews. Cancel anytime.");
    expect(trial_timeline(plan, { now, formatDate: format_date })).toEqual([
      { when: "Today", what: "Your free trial starts. Get everything in Votic Premium." },
      {
        when: "Around 2026-10-15",
        what: "Billing begins at $9.99/month. The store confirms the exact date before you subscribe.",
      },
    ]);
  });
  it("adds only the trial under a plan card's price, so the price isn't repeated", () => {
    expect(plan_card_detail(monthly(7))).toBe("Includes a 7-day free trial");
    expect(plan_card_detail(monthly(null))).toBeNull();
  });
  it("names plans by billing period", () => {
    expect(plan_name(monthly(7))).toBe("Monthly");
    expect(plan_name({ ...monthly(null), billingPeriod: { count: 1, unit: "year" } })).toBe("Yearly");
  });
  it("counts week trials in days and month trials on the calendar", () => {
    expect(format_date(trial_end_date({ count: 1, unit: "week" }, now))).toBe("2026-10-08");
    expect(format_date(trial_end_date({ count: 1, unit: "month" }, now))).toBe("2026-11-01");
  });
});

it("keeps month-end and leap-year trial estimates within the destination month", () => {
  expect(format_date(trial_end_date({ count: 1, unit: "month" }, new Date("2026-01-31T12:00:00Z")))).toBe(
    "2026-02-28",
  );
  expect(format_date(trial_end_date({ count: 1, unit: "year" }, new Date("2028-02-29T12:00:00Z")))).toBe(
    "2029-02-28",
  );
});

it("shows localized introductory charges, their payment counts, then the regular renewal price", () => {
  const plan: SubscriptionPlan = {
    ...monthly(null, "9,99 €"),
    introductoryPrices: [{ priceString: "0,99 €", period: { count: 1, unit: "month" }, cycles: 3 }],
  };
  expect(price_sequence(plan)).toBe("0,99 € per month for 3 payments, then 9,99 €/month");
  expect(primary_action_label(plan)).toBe("Subscribe for 0,99 €/month");
  expect(billing_summary(plan, "Google Play")).toBe(
    "0,99 € per month for 3 payments, then 9,99 €/month. Auto-renews. Cancel anytime in Google Play.",
  );
  expect(billing_terms(plan, { now, store: "Google Play", formatDate: format_date })).toMatch(
    /^You'll be charged 0,99 € when you subscribe/,
  );
  expect(billing_summary({ ...plan, trial: { count: 7, unit: "day" } })).toMatch(
    /^7 days free, then 0,99 € per month for 3 payments, then 9,99 €\/month/,
  );
});
