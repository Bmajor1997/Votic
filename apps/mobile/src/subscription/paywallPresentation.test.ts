import { describe, expect, it } from "vitest";
import { plan_from_store_product } from "./entitlement";
import { annual_value, PREVIEW_WORDS, preview_word_at } from "./paywallPresentation";
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

it("maps real speech boundary offsets to their matching words", () => {
  expect(preview_word_at(-1)).toBe(-1);
  expect(preview_word_at(NaN)).toBe(-1);
  for (const [index, word] of PREVIEW_WORDS.entries()) expect(preview_word_at(word.start)).toBe(index);
});
