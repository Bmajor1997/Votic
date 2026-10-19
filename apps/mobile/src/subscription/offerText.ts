import { Period, SubscriptionPlan } from "./subscriptionTypes";

const DAYS_PER: Record<Period["unit"], number> = { day: 1, week: 7, month: 30, year: 365 };

/** "7 days", "1 week", "2 weeks". Weeks under a month read better as days when they're not whole. */
export function period_length({ count, unit }: Period) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** "7-day", "2-week": the length used before a noun, as in "7-day free trial". */
export function period_adjective({ count, unit }: Period) {
  return `${count}-${unit}`;
}

/** "month" for P1M, "3 months" for P3M: the phrase after "per" or "/". */
export function billing_period_label(period: Period | null) {
  if (!period) return null;
  return period.count === 1 ? period.unit : `${period.count} ${period.unit}s`;
}

/** "Monthly", "Yearly", "Every 3 months". */
export function plan_name(plan: SubscriptionPlan) {
  const period = plan.billingPeriod;
  if (!period) return "Votic subscription";
  if (period.count === 1)
    return { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" }[period.unit];
  return `Every ${period.count} ${period.unit}s`;
}

/** The date a free trial ends if started now. Months and years are counted on the calendar, like the stores do. */
export function trial_end_date(trial: Period, now: Date) {
  const end = new Date(now.getTime());
  if (trial.unit === "month") end.setMonth(end.getMonth() + trial.count);
  else if (trial.unit === "year") end.setFullYear(end.getFullYear() + trial.count);
  else end.setDate(end.getDate() + trial.count * DAYS_PER[trial.unit]);
  return end;
}

/** The store's localized price with its period, e.g. "$9.99/month". */
export function price_label(plan: SubscriptionPlan) {
  const per = billing_period_label(plan.billingPeriod);
  return per ? `${plan.priceString}/${per}` : plan.priceString;
}

/** Short billing line above the button, e.g. "2 weeks free, then $9.99/month. Cancel anytime." */
export function billing_summary(plan: SubscriptionPlan) {
  const price = price_label(plan);
  return plan.trial
    ? `${period_length(plan.trial)} free, then ${price}. Cancel anytime.`
    : `${price}. Cancel anytime.`;
}

/**
 * The line under a plan card's price. The card already shows the price, so it adds only the trial; the
 * full "then $x" sentence stays in billing_summary above the button.
 */
export function plan_card_detail(plan: SubscriptionPlan) {
  return plan.trial ? `Includes a ${period_adjective(plan.trial)} free trial` : null;
}

/**
 * The purchase button. With a trial it says what tapping does today (start the trial; the line above
 * gives the price after it). Without one, the price is on the button itself, so nobody pays by surprise.
 */
export function primary_action_label(plan: SubscriptionPlan | null) {
  if (!plan) return "Subscribe";
  return plan.trial ? "Start free trial" : `Subscribe for ${price_label(plan)}`;
}

/** The paywall's heading, worded from the store's trial length: "Try Votic Premium free for 2 weeks". */
export function offer_title(plan: SubscriptionPlan | null) {
  return plan?.trial ? `Try Votic Premium free for ${period_length(plan.trial)}` : "Get Votic Premium";
}

/** "Today" and the day billing starts, for the trial timeline. Only shown when the plan has a trial. */
export function trial_timeline(
  plan: SubscriptionPlan,
  { now, formatDate }: { now: Date; formatDate: (date: Date) => string },
) {
  if (!plan.trial) return [];
  return [
    { when: "Today", what: "Your free trial starts. Get everything in Votic Premium." },
    {
      when: formatDate(trial_end_date(plan.trial, now)),
      what: `Your subscription starts at ${price_label(plan)}. Cancel at least a day before and you won't be charged.`,
    },
  ];
}

/**
 * Full terms: when billing begins, that it renews automatically, and how to cancel. Every number comes
 * from the store product, so changing the trial or price in App Store Connect / Play Console updates this text.
 */
export function billing_terms(
  plan: SubscriptionPlan,
  {
    now,
    store,
    formatDate,
  }: { now: Date; store: "App Store" | "Google Play"; formatDate: (date: Date) => string },
) {
  const per = billing_period_label(plan.billingPeriod) || "billing period";
  const renew = `Your subscription renews automatically at ${plan.priceString} per ${per} until you cancel.`;
  const cancel = `Cancel anytime in your ${store} subscription settings at least 24 hours before ${plan.trial ? "your trial ends" : "it renews"} to avoid being charged.`;
  if (!plan.trial) return `You'll be charged ${plan.priceString} when you subscribe. ${renew} ${cancel}`;
  const end = formatDate(trial_end_date(plan.trial, now));
  return `Your ${period_adjective(plan.trial)} free trial starts today. You won't be charged until it ends on ${end}. ${renew} ${cancel}`;
}
