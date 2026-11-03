/**
 * When Votic asks the store for its review card (Google Play's in-app review, later the App Store's).
 *
 * The store shows its own card; Votic never asks a question first (Google Play doesn't allow asking "Do you like
 * Votic?" before or while showing it) and never learns whether a review was left. Votic only picks the moment:
 * right after someone closes a document, once they've used Votic on a few different days, and rarely.
 */
export const STORE_REVIEW_KEY = "votic.mobile.store-review.v1";
/** Days with at least a minute of reading or listening before the first ask. */
export const MIN_ACTIVE_DAYS = 3;
/** At least this long between asks. The store also limits how often its card appears. */
export const REVIEW_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;
/** Never more than this many asks for one account. */
export const MAX_REVIEW_ASKS = 3;

export type ReviewState = { asks: number; lastAskedAt: number | null };
export const NO_REVIEW_ASKS: ReviewState = { asks: 0, lastAskedAt: null };

/** What was saved, or no asks yet when nothing (or something unreadable) was saved. */
export function parse_review_state(raw: string | null): ReviewState {
  try {
    const value = JSON.parse(raw ?? "null") as Partial<ReviewState> | null;
    if (!value || typeof value !== "object") return NO_REVIEW_ASKS;
    const asks = Number.isInteger(value.asks) && (value.asks as number) >= 0 ? (value.asks as number) : 0;
    const lastAskedAt =
      typeof value.lastAskedAt === "number" && Number.isFinite(value.lastAskedAt) ? value.lastAskedAt : null;
    return { asks, lastAskedAt };
  } catch {
    return NO_REVIEW_ASKS;
  }
}

/** Whether this is a good time to ask for a review. */
export function review_due(state: ReviewState, activeDays: number, now: number) {
  if (activeDays < MIN_ACTIVE_DAYS || state.asks >= MAX_REVIEW_ASKS) return false;
  return state.lastAskedAt === null || now - state.lastAskedAt >= REVIEW_COOLDOWN_MS;
}

/** Votic's Google Play page, for the "Rate Votic on Google Play" row. */
export const PLAY_STORE_APP = "market://details?id=com.votic.app";
export const PLAY_STORE_WEB = "https://play.google.com/store/apps/details?id=com.votic.app";
