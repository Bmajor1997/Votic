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
  research: {
    title: "Go deeper.\nFind the thread.",
    detail: "Read papers your way and ask questions grounded in your documents.",
  },
  personal: {
    title: "Your reading.\nAt your rhythm.",
    detail: "Make room for your articles and books, with listening that fits your day.",
  },
  accessibility: {
    title: "Let reading\nwork for you.",
    detail: "Hear the words, follow the highlights, and make the page comfortable.",
  },
};

/** These are examples, never generated answers or claims about the visitor's own documents. */
export const PREVIEW_TEXT =
  "Big ideas start with small steps. Read a little, listen a little, and make room for something new.";
export const PREVIEW_WORDS = Array.from(PREVIEW_TEXT.matchAll(/\S+/g), (match) => ({
  text: match[0],
  start: match.index,
}));
export const PREVIEW_ANSWER =
  "Small, regular moments of reading and listening can help you explore new ideas.";

export function preview_word_at(charIndex: number) {
  if (!Number.isFinite(charIndex) || charIndex < 0) return -1;
  return PREVIEW_WORDS.findLastIndex((word) => word.start <= charIndex);
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
    return { savings, equivalent, comparison: `Save ${savings}% compared with 12 monthly payments` };
  } catch {
    return null;
  }
}
