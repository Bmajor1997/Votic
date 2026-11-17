import type { HighlightMode } from "../accessibility/AccessibilityProvider";
import type { VoticPurpose } from "../personalization/PurposeProvider";
import { normalize_playback_rate } from "../playback/rates";

/**
 * The first-launch tour, before sign-in (modeled on Recipeek's tour, Nov 2026): welcome, hear Votic on a sample page,
 * what it should help with, the reading style, and how it should sound, then what's free. Kept on this device because
 * no account exists yet. Text size, spacing, font, motion and the voice are already device settings; the answers below
 * are account settings, so they wait here until the new account is created and are then given to it once.
 */
export type IntroEntry = "create" | "sign-in";
export type Intro = {
  /** Past the tour: finished it, or this phone already used Votic or has signed in. */
  done: boolean;
  /** Went through the tour to the end on this phone (Skip included), rather than being past it already. */
  toured: boolean;
  /** How the tour ended: "create" goes on to make an account; "sign-in" was "I already have an account". */
  entry: IntroEntry;
  purpose: VoticPurpose | null;
  highlightMode: HighlightMode;
  defaultPlaybackRate: number;
  /** The account that received these answers; a later new account on this phone starts from defaults. */
  claimedBy: string | null;
};

export const DEFAULT_INTRO: Intro = {
  done: false,
  toured: false,
  entry: "create",
  purpose: null,
  highlightMode: "both",
  defaultPlaybackRate: 1,
  claimedBy: null,
};

export const INTRO_KEY = "votic.mobile.intro.v1";
const PURPOSES: VoticPurpose[] = ["learning", "work", "personal"];
const HIGHLIGHTS: HighlightMode[] = ["both", "word", "sentence", "off"];

/** Reads the saved tour, keeping whatever is valid, so a damaged value never shows the tour twice or crashes. */
export function parse_intro(raw: string | null): Intro {
  if (!raw) return { ...DEFAULT_INTRO };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_INTRO };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ...DEFAULT_INTRO };
  const v = data as Record<string, unknown>;
  const rate = Number(v.defaultPlaybackRate);
  return {
    done: v.done === true,
    toured: v.toured === true,
    entry: v.entry === "sign-in" ? "sign-in" : "create",
    purpose: PURPOSES.includes(v.purpose as VoticPurpose) ? (v.purpose as VoticPurpose) : null,
    highlightMode: HIGHLIGHTS.includes(v.highlightMode as HighlightMode)
      ? (v.highlightMode as HighlightMode)
      : "both",
    defaultPlaybackRate: Number.isFinite(rate) ? normalize_playback_rate(rate) : 1,
    claimedBy: typeof v.claimedBy === "string" && v.claimedBy ? v.claimedBy : null,
  };
}

/**
 * The tour's answers for the account made right after it, once: never for an existing account, for a new account
 * that came through "I already have an account" (it gets the usual questions), or for a second new account.
 */
export function intro_answers_for(intro: Intro, account: { uid: string; isNewAccount: boolean }) {
  if (!intro.toured || intro.entry !== "create" || !account.isNewAccount) return null;
  if (intro.claimedBy && intro.claimedBy !== account.uid) return null;
  return {
    purpose: intro.purpose,
    highlightMode: intro.highlightMode,
    defaultPlaybackRate: intro.defaultPlaybackRate,
  };
}
