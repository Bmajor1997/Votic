import { describe, expect, it } from "vitest";
import {
  MAX_REVIEW_ASKS,
  MIN_ACTIVE_DAYS,
  NO_REVIEW_ASKS,
  REVIEW_COOLDOWN_MS,
  parse_review_state,
  review_due,
} from "./storeReview";

const NOW = Date.UTC(2026, 10, 3);

describe("when Votic asks the store for a review", () => {
  it("waits until Votic has been used on a few different days", () => {
    expect(review_due(NO_REVIEW_ASKS, MIN_ACTIVE_DAYS - 1, NOW)).toBe(false);
    expect(review_due(NO_REVIEW_ASKS, MIN_ACTIVE_DAYS, NOW)).toBe(true);
  });

  it("asks rarely: months apart, and only a few times ever", () => {
    const asked = { asks: 1, lastAskedAt: NOW };
    expect(review_due(asked, 10, NOW + REVIEW_COOLDOWN_MS - 1)).toBe(false);
    expect(review_due(asked, 10, NOW + REVIEW_COOLDOWN_MS)).toBe(true);
    expect(review_due({ asks: MAX_REVIEW_ASKS, lastAskedAt: 0 }, 10, NOW)).toBe(false);
  });

  it("treats missing or unreadable saved state as no asks yet", () => {
    expect(parse_review_state(null)).toEqual(NO_REVIEW_ASKS);
    expect(parse_review_state("not json")).toEqual(NO_REVIEW_ASKS);
    expect(parse_review_state(JSON.stringify({ asks: -2, lastAskedAt: "x" }))).toEqual(NO_REVIEW_ASKS);
    expect(parse_review_state(JSON.stringify({ asks: 2, lastAskedAt: NOW }))).toEqual({
      asks: 2,
      lastAskedAt: NOW,
    });
  });
});
