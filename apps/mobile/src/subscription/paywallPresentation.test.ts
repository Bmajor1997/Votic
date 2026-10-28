import { describe, expect, it } from "vitest";
import { plan_from_store_product } from "./entitlement";
import {
  annual_value,
  MAX_TRY_TEXT,
  PAYWALL_GOALS,
  PREVIEW_SAMPLES,
  preview_word_at,
  preview_words,
} from "./paywallPresentation";
import type { SubscriptionPlan } from "./subscriptionTypes";

const monthly: SubscriptionPlan = {
  id: "monthly",
  priceString: "$9.99",
  priceAmount: 9.99,
  currencyCode: "USD",
  billingPeriod: { count: 1, unit: "month" },
  trial: null,
};
const annual: SubscriptionPlan = {
  ...monthly,
  id: "annual",
  priceString: "$79.99",
  priceAmount: 79.99,
  billingPeriod: { count: 1, unit: "year" },
};

describe("store-derived offer presentation", () => {
  it("compares a full year with 12 monthly payments without overstating savings", () => {
    expect(annual_value(annual, [monthly, annual])).toMatchObject({ savings: 33, equivalent: "$6.67" });
    expect(annual_value(monthly, [monthly, annual])).toBeNull();
  });
  it("suppresses savings for different currencies, ambiguous tiers, missing prices and annual premiums", () => {
    for (const plan of [
      { ...annual, currencyCode: "EUR" },
      { ...annual, priceAmount: undefined },
      { ...annual, priceAmount: 150 },
      { ...annual, priceAmount: NaN },
    ])
      expect(annual_value(plan, [monthly, plan])).toBeNull();
    expect(annual_value(annual, [monthly, { ...monthly, id: "another-tier" }, annual])).toBeNull();
  });
  it("keeps numeric store prices separate from localized display strings", () => {
    expect(
      plan_from_store_product("annual", {
        identifier: "year",
        priceString: "79,99 €",
        price: 79.99,
        currencyCode: "EUR",
        subscriptionPeriod: "P1Y",
        introPrice: null,
      }),
    ).toMatchObject({ priceAmount: 79.99, currencyCode: "EUR", priceString: "79,99 €" });
  });
});

it("maps real speech boundary offsets to their matching words, in any text", () => {
  for (const text of [PREVIEW_SAMPLES.default.text, "  Pasted   text,\nwith odd   spacing. "]) {
    const words = preview_words(text);
    expect(preview_word_at(words, -1)).toBe(-1);
    expect(preview_word_at(words, NaN)).toBe(-1);
    for (const [index, word] of words.entries()) {
      expect(text.slice(word.start, word.start + word.text.length)).toBe(word.text);
      expect(preview_word_at(words, word.start)).toBe(index);
    }
  }
  expect(preview_words("")).toEqual([]);
});

it("has a short sample page, question and answer for every goal, including no goal", () => {
  expect(Object.keys(PREVIEW_SAMPLES).sort()).toEqual(Object.keys(PAYWALL_GOALS).sort());
  for (const sample of Object.values(PREVIEW_SAMPLES)) {
    for (const value of [sample.title, sample.question, sample.text, sample.answer])
      expect(value.trim().length).toBeGreaterThan(0);
    // Short enough to hear in a few seconds, and within what a visitor may paste.
    expect(sample.text.length).toBeLessThanOrEqual(140);
    expect(sample.text.length).toBeLessThanOrEqual(MAX_TRY_TEXT);
  }
  expect(new Set(Object.values(PREVIEW_SAMPLES).map((sample) => sample.text)).size).toBe(4);
});
