import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HighlightMode } from "../accessibility/AccessibilityProvider";
import type { ExplanationStyle } from "../personalization/PurposeProvider";
import { normalize_playback_rate } from "../playback/rates";

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
export const account_preferences_key = (uid: string) => `votic.mobile.personalization-preferences.v1:${uid}`;

export async function load_account_preferences(uid: string): Promise<AccountPreferences | null> {
  const raw = await AsyncStorage.getItem(account_preferences_key(uid));
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
      defaultPlaybackRate: normalize_playback_rate(value.defaultPlaybackRate),
    };
  } catch {
    return null;
  }
}
export async function save_account_preferences(uid: string, value: AccountPreferences) {
  await AsyncStorage.setItem(account_preferences_key(uid), JSON.stringify(value));
}
export async function remove_account_preferences(uid: string) {
  await AsyncStorage.removeItem(account_preferences_key(uid));
}
