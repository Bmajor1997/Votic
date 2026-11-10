/** A Votic Free account's camera scan pages this month (null for every other plan). */
export type ScanAllowance = { remaining: number; limit: number };

/** The scan was stopped before reading any page because it needs more Free scan pages than are left. */
export class ScanLimitReached extends Error {
  constructor() {
    super("Not enough Free scan pages left for this scan.");
  }
}

/** Server limit codes that open the Votic Plus sheet instead of an error alert. */
export const SCAN_LIMIT_CODES = ["FREE_SCANS_EXHAUSTED", "AI_CREDITS_EXHAUSTED"];

/** Whether a scan of `needed` new pages fits the Free pages left. Unknown (null) goes ahead; the server still checks. */
export function scan_pages_covered(needed: number, allowance: ScanAllowance | null) {
  return !allowance || needed <= allowance.remaining;
}

/** Free scan pages renew on the first day of the next calendar month (UTC), as on the server. */
export function next_free_reset(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export function scan_allowance_text(allowance: ScanAllowance) {
  return `${allowance.remaining} of ${allowance.limit} Free scan pages remaining this month.`;
}
