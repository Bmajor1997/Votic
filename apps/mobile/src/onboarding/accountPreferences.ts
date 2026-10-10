import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HighlightMode } from "../accessibility/AccessibilityProvider";
import type { ExplanationStyle } from "../personalization/PurposeProvider";
import { normalizePlaybackRate } from "../playback/rates";

export type AccountPreferences = {
  explanationStyle: ExplanationStyle;
  highlightMode: HighlightMode;
  defaultPlaybackRate: number;
};
export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  explanationStyle: "adaptive",
  highlightMode: "both",
  defaultPlaybackRate: 1,
};
export const accountPreferencesKey = (uid: string) => `votic.mobile.personalization-preferences.v1:${uid}`;

export async function loadAccountPreferences(uid: string): Promise<AccountPreferences | null> {
  const raw = await AsyncStorage.getItem(accountPreferencesKey(uid));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      !value ||
      !["adaptive", "quick", "simple", "detailed"].includes(value.explanationStyle) ||
      !["off", "word", "sentence", "both"].includes(value.highlightMode) ||
      typeof value.defaultPlaybackRate !== "number" ||
      !Number.isFinite(value.defaultPlaybackRate)
    )
      return null;
    return {
      explanationStyle: value.explanationStyle,
      highlightMode: value.highlightMode,
      defaultPlaybackRate: normalizePlaybackRate(value.defaultPlaybackRate),
    };
  } catch {
    return null;
  }
}
export async function saveAccountPreferences(uid: string, value: AccountPreferences) {
  await AsyncStorage.setItem(accountPreferencesKey(uid), JSON.stringify(value));
}
export async function removeAccountPreferences(uid: string) {
  await AsyncStorage.removeItem(accountPreferencesKey(uid));
}
