/** What the scanner knows about a Votic Free account's scan pages this month (null for every other plan). */
export type ScanAllowance = { remaining: number; limit: number; pageCredits: number; purchased: number };

/** The scan was stopped before reading any page because Free pages and purchased credits can't cover it. */
export class ScanLimitReached extends Error {
  constructor() {
    super("Not enough Free scan pages or credits for this scan.");
  }
}

/** Server limit codes that open the Votic Plus sheet (with "Just need a few more?") instead of an error alert. */
export const SCAN_LIMIT_CODES = ["FREE_SCANS_EXHAUSTED", "AI_CREDITS_EXHAUSTED"];

/**
 * Whether a scan of `needed` new pages can go ahead: included Free pages first, then purchased credits pay for the
 * rest at the server's per-page price. Unknown (null) always goes ahead; the server still enforces the limit.
 */
export function scan_pages_covered(needed: number, allowance: ScanAllowance | null) {
  if (!allowance) return true;
  const extra = needed - allowance.remaining;
  return extra <= 0 || allowance.purchased >= extra * allowance.pageCredits;
}

/** Free scan pages renew on the first day of the next calendar month (UTC), as on the server. */
export function next_free_reset(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

/** "1 of 3 Free scan pages remaining this month." plus purchased credits when there are any. */
export function scan_allowance_text(allowance: ScanAllowance) {
  const pages = `${allowance.remaining} of ${allowance.limit} Free scan pages remaining this month.`;
  if (!allowance.purchased) return pages;
  return `${pages} ${allowance.purchased} purchased ${allowance.purchased === 1 ? "credit" : "credits"} for more.`;
}
