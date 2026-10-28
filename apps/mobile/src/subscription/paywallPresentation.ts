import type { VoticPurpose } from "../personalization/PurposeProvider";
import type { SubscriptionPlan } from "./subscriptionTypes";

export const PAYWALL_GOALS: Record<VoticPurpose | "default", { title: string; detail: string }> = {
  default: {
    title: "Make more of\nwhat you read.",
    detail: "Turn your documents into listening, answers, and ideas that stay with you.",
  },
  learning: {
    title: "Make your next\nstudy session click.",
    detail: "Listen to your material, ask questions, and revisit the ideas that matter.",
  },
  work: {
    title: "Less reading backlog.\nMore clarity.",
    detail: "Listen to reports and find the answers you need in your documents.",
  },
  personal: {
    title: "Your reading.\nAt your rhythm.",
    detail: "Make room for your articles and books, with listening that fits your day.",
  },
};

export { PREVIEW_SAMPLES } from "../onboarding/sampleDocument";
export type { PreviewSample } from "../onboarding/sampleDocument";

/** Longest text a visitor can paste into the preview: about a paragraph, enough to hear the difference. */
export const MAX_TRY_TEXT = 500;

export type PreviewWord = { text: string; start: number };
export function preview_words(text: string): PreviewWord[] {
  return Array.from(text.matchAll(/\S+/g), (match) => ({ text: match[0], start: match.index }));
}

/** The word a speech-engine boundary (a character offset into the spoken text) falls in. */
export function preview_word_at(words: PreviewWord[], charIndex: number) {
  if (!Number.isFinite(charIndex) || charIndex < 0) return -1;
  return words.findLastIndex((word) => word.start <= charIndex);
}

/** No parsing "$9.99": localized display strings are not safe arithmetic inputs. */
export function annual_value(plan: SubscriptionPlan, plans: SubscriptionPlan[]) {
  if (plan.billingPeriod?.unit !== "year" || plan.billingPeriod.count !== 1) return null;
  const monthly = plans.filter(
    (candidate) => candidate.billingPeriod?.unit === "month" && candidate.billingPeriod.count === 1,
  );
  // Ambiguous product families/tier comparisons must not create a made-up savings badge.
  if (
    monthly.length !== 1 ||
    plans.filter((candidate) => candidate.billingPeriod?.unit === "year").length !== 1
  )
    return null;
  const other = monthly[0];
  if (
    !plan.priceAmount ||
    !other.priceAmount ||
    !Number.isFinite(plan.priceAmount) ||
    !Number.isFinite(other.priceAmount) ||
    plan.priceAmount < 0 ||
    other.priceAmount < 0 ||
    !plan.currencyCode ||
    plan.currencyCode !== other.currencyCode
  )
    return null;
  const savings = Math.floor((1 - plan.priceAmount / (other.priceAmount * 12)) * 100);
  if (savings <= 0 || savings >= 100) return null;
  try {
    const equivalent = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: plan.currencyCode,
    }).format(plan.priceAmount / 12);
    return {
      savings,
      equivalent,
      comparison: `Save ${savings}% compared with 12 monthly payments at regular prices`,
    };
  } catch {
    return null;
  }
}

const is_period = (plan: SubscriptionPlan, unit: "month" | "year") =>
  plan.billingPeriod?.unit === unit && plan.billingPeriod.count === 1;

/**
 * Votic Plus is one subscription billed monthly or yearly, with the same features either way. The paywall
 * offers the store's monthly and annual packages; anything else in the offering (a weekly test package, a V2
 * tier) is not shown. If the offering has neither, its first package is offered as it is.
 */
export function plus_plans(plans: SubscriptionPlan[]) {
  const monthly = plans.find((plan) => is_period(plan, "month"));
  const annual = plans.find((plan) => is_period(plan, "year"));
  const found = [monthly, annual].filter((plan): plan is SubscriptionPlan => Boolean(plan));
  return found.length ? found : plans.slice(0, 1);
}

/** Monthly is preselected, so the larger annual charge is only ever chosen by the person. */
export function default_plan(plans: SubscriptionPlan[]) {
  const shown = plus_plans(plans);
  return shown.find((plan) => is_period(plan, "month")) ?? shown[0] ?? null;
}

/** The other Votic Plus billing period, for a subscriber who wants to switch. */
export function other_billing_plan(plans: SubscriptionPlan[], currentProductId: string | null | undefined) {
  if (!currentProductId) return null;
  const shown = plus_plans(plans);
  const current = shown.find((plan) => plan.productId === currentProductId);
  return current ? (shown.find((plan) => plan !== current && plan.billingPeriod) ?? null) : null;
}
