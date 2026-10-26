/**
 * The signed-in account's AI usage as Votic's server reports it. Every number comes from the server's ledger;
 * nothing here is estimated on the phone, and an unreadable answer is an error rather than a guess.
 */
export type AiUsage = {
  status: "active" | "unmetered" | "not-subscribed" | "not-configured";
  plan: { name: string } | null;
  monthly: {
    percentRemaining: number;
    periodEnd: string;
    resetsAt: string;
    /** False when the store reported no billing end and the allowance resets on the calendar month. */
    billingPeriodVerified: boolean;
  } | null;
  /** Additional usage bought separately; it is used after the monthly allowance and survives renewal. */
  purchased: { remaining: number } | null;
  /** Store product IDs the server credits for additional usage. Empty when none are configured. */
  purchaseProducts: string[];
};

const STATUSES = ["active", "unmetered", "not-subscribed", "not-configured"] as const;
const valid_date = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const unreadable = () => new Error("Votic couldn't read your AI usage. Please try again.");

function parse_monthly(monthly: Record<string, unknown> | null | undefined): AiUsage["monthly"] {
  if (!monthly) return null;
  const percent = monthly.percentRemaining;
  const valid_percent =
    typeof percent === "number" && Number.isInteger(percent) && percent >= 0 && percent <= 100;
  if (!valid_percent || !valid_date(monthly.periodEnd) || !valid_date(monthly.resetsAt)) throw unreadable();
  return {
    percentRemaining: percent,
    periodEnd: monthly.periodEnd,
    resetsAt: monthly.resetsAt,
    billingPeriodVerified: monthly.billingPeriodVerified === true,
  };
}

export function parse_ai_usage(result: Record<string, unknown>): AiUsage {
  const status = result.status as AiUsage["status"];
  if (!STATUSES.includes(status)) throw unreadable();
  const monthly = parse_monthly(result.monthly as Record<string, unknown> | null | undefined);
  if (status === "active" && !monthly) throw unreadable();
  const remaining = (result.purchased as Record<string, unknown> | null | undefined)?.remaining;
  const plan = result.plan as Record<string, unknown> | null | undefined;
  return {
    status,
    plan: plan && typeof plan.name === "string" ? { name: plan.name } : null,
    monthly,
    purchased:
      typeof remaining === "number" && Number.isSafeInteger(remaining) && remaining >= 0
        ? { remaining }
        : null,
    purchaseProducts: Array.isArray(result.purchaseProducts)
      ? result.purchaseProducts.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [],
  };
}

export function format_usage_date(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/** "Renews November 3, 2026" for a verified billing period; a calendar-month reset says "Resets". */
export function usage_reset_label(monthly: NonNullable<AiUsage["monthly"]>) {
  return `${monthly.billingPeriodVerified ? "Renews" : "Resets"} ${format_usage_date(monthly.resetsAt)}`;
}

type Listener = () => void;
const listeners = new Set<Listener>();
/** AI Usage refreshes when an AI request finishes instead of polling. */
export function subscribe_ai_usage_changes(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function notify_ai_usage_changed() {
  for (const listener of [...listeners]) listener();
}
/** Requests that can spend AI usage. */
export const AI_USAGE_PATHS = [
  "/api/help",
  "/api/scan",
  "/api/extract",
  "/api/transcribe-question",
  "/api/review",
];
