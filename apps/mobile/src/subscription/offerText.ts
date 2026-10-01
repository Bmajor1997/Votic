import { Period, SubscriptionPlan } from "./subscriptionTypes";

const DAYS_PER: Record<Period["unit"], number> = { day: 1, week: 7, month: 30, year: 365 };

/** "7 days", "1 week", "2 weeks". Weeks under a month read better as days when they're not whole. */
export function periodLength({ count, unit }: Period) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** "7-day", "2-week": the length used before a noun, as in "7-day free trial". */
export function periodAdjective({ count, unit }: Period) {
  return `${count}-${unit}`;
}

/** "month" for P1M, "3 months" for P3M: the phrase after "per" or "/". */
export function billingPeriodLabel(period: Period | null) {
  if (!period) return null;
  return period.count === 1 ? period.unit : `${period.count} ${period.unit}s`;
}

/** "Monthly", "Yearly", "Every 3 months". */
export function planName(plan: SubscriptionPlan) {
  const period = plan.billingPeriod;
  if (!period) return "Votic subscription";
  if (period.count === 1)
    return { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" }[period.unit];
  return `Every ${period.count} ${period.unit}s`;
}

/** The date a free trial ends if started now. Months and years are counted on the calendar, like the stores do. */
export function trialEndDate(trial: Period, now: Date) {
  const end = new Date(now.getTime());
  if (trial.unit === "month") end.setMonth(end.getMonth() + trial.count);
  else if (trial.unit === "year") end.setFullYear(end.getFullYear() + trial.count);
  else end.setDate(end.getDate() + trial.count * DAYS_PER[trial.unit]);
  return end;
}

/** The store's localized price with its period, e.g. "$9.99/month". */
export function priceLabel(plan: SubscriptionPlan) {
  const per = billingPeriodLabel(plan.billingPeriod);
  return per ? `${plan.priceString}/${per}` : plan.priceString;
}

/** Short billing line above the button, e.g. "2 weeks free, then $9.99/month. Cancel anytime." */
export function billingSummary(plan: SubscriptionPlan) {
  const price = priceLabel(plan);
  return plan.trial
    ? `${periodLength(plan.trial)} free, then ${price}. Cancel anytime.`
    : `${price}. Cancel anytime.`;
}

/**
 * The purchase button. With a trial it says what tapping does today (start the trial; the line above
 * gives the price after it). Without one, the price is on the button itself, so nobody pays by surprise.
 */
export function primaryActionLabel(plan: SubscriptionPlan | null) {
  if (!plan) return "Subscribe";
  return plan.trial ? "Start free trial" : `Subscribe for ${priceLabel(plan)}`;
}

/** The paywall's heading, worded from the store's trial length: "Try Votic Premium free for 2 weeks". */
export function offerTitle(plan: SubscriptionPlan | null) {
  return plan?.trial ? `Try Votic Premium free for ${periodLength(plan.trial)}` : "Get Votic Premium";
}

/** "Today" and the day billing starts, for the trial timeline. Only shown when the plan has a trial. */
export function trialTimeline(
  plan: SubscriptionPlan,
  { now, formatDate }: { now: Date; formatDate: (date: Date) => string },
) {
  if (!plan.trial) return [];
  return [
    { when: "Today", what: "Your free trial starts. Get everything in Votic Premium." },
    {
      when: formatDate(trialEndDate(plan.trial, now)),
      what: `Your subscription starts at ${priceLabel(plan)}. Cancel at least a day before and you won't be charged.`,
    },
  ];
}

/**
 * Full terms: when billing begins, that it renews automatically, and how to cancel. Every number comes
 * from the store product, so changing the trial or price in App Store Connect / Play Console updates this text.
 */
export function billingTerms(
  plan: SubscriptionPlan,
  {
    now,
    store,
    formatDate,
  }: { now: Date; store: "App Store" | "Google Play"; formatDate: (date: Date) => string },
) {
  const per = billingPeriodLabel(plan.billingPeriod) || "billing period";
  const renew = `Your subscription renews automatically at ${plan.priceString} per ${per} until you cancel.`;
  const cancel = `Cancel anytime in your ${store} subscription settings at least 24 hours before ${plan.trial ? "your trial ends" : "it renews"} to avoid being charged.`;
  if (!plan.trial) return `You'll be charged ${plan.priceString} when you subscribe. ${renew} ${cancel}`;
  const end = formatDate(trialEndDate(plan.trial, now));
  return `Your ${periodAdjective(plan.trial)} free trial starts today. You won't be charged until it ends on ${end}. ${renew} ${cancel}`;
}
