import { describe, expect, it } from "vitest";
import { DEFAULT_INTRO, intro_answers_for, parse_intro } from "./introModel";

const finished = {
  ...DEFAULT_INTRO,
  done: true,
  toured: true,
  purpose: "learning" as const,
  highlightMode: "word" as const,
};

describe("first-launch tour storage", () => {
  it("starts a new install at the tour and reads damaged values safely", () => {
    expect(parse_intro(null)).toEqual(DEFAULT_INTRO);
    expect(parse_intro("{not json")).toEqual(DEFAULT_INTRO);
    expect(parse_intro("[1]")).toEqual(DEFAULT_INTRO);
    expect(
      parse_intro(
        JSON.stringify({ done: true, purpose: "cooking", highlightMode: "rainbow", defaultPlaybackRate: 9 }),
      ),
    ).toMatchObject({ done: true, purpose: null, highlightMode: "both", defaultPlaybackRate: 4 });
  });

  it("gives the answers only to a new account made after finishing the tour, and only once", () => {
    const account = { uid: "a", isNewAccount: true };
    expect(intro_answers_for(finished, account)).toEqual({
      purpose: "learning",
      highlightMode: "word",
      defaultPlaybackRate: 1,
    });
    expect(intro_answers_for(finished, { ...account, isNewAccount: false })).toBeNull();
    expect(intro_answers_for({ ...finished, entry: "sign-in" }, account)).toBeNull();
    expect(intro_answers_for({ ...finished, toured: false }, account)).toBeNull();
    expect(intro_answers_for({ ...finished, claimedBy: "a" }, account)).not.toBeNull();
    expect(intro_answers_for({ ...finished, claimedBy: "a" }, { uid: "b", isNewAccount: true })).toBeNull();
  });
});
