import AsyncStorage from "@react-native-async-storage/async-storage";
import { write_account_data } from "../storage/accountDeletion";
import type { HighlightMode } from "../accessibility/AccessibilityProvider";
import { PURPOSES, type ExplanationStyle, type VoticPurpose } from "../personalization/PurposeProvider";
import { normalize_playback_rate } from "../playback/rates";

export type AccountPreferences = {
  explanationStyle: ExplanationStyle;
  highlightMode: HighlightMode;
  defaultPlaybackRate: number;
  /** What this account said Votic should help with. Kept per account so a second account starts fresh. */
  purpose: VoticPurpose | null;
};
/** Saved preferences; `purpose` is missing from those saved before it moved here from the device. */
export type SavedAccountPreferences = Omit<AccountPreferences, "purpose"> & { purpose?: VoticPurpose | null };
export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  explanationStyle: "adaptive",
  highlightMode: "both",
  defaultPlaybackRate: 1,
  purpose: null,
};
export const account_preferences_key = (uid: string) => `votic.mobile.personalization-preferences.v1:${uid}`;

export async function load_account_preferences(uid: string): Promise<SavedAccountPreferences | null> {
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
      ...("purpose" in value
        ? { purpose: PURPOSES.some((item) => item.value === value.purpose) ? value.purpose : null }
        : {}),
    };
  } catch {
    return null;
  }
}
export async function save_account_preferences(uid: string, value: AccountPreferences) {
  await write_account_data(uid, () =>
    AsyncStorage.setItem(account_preferences_key(uid), JSON.stringify(value)),
  );
}
export async function remove_account_preferences(uid: string) {
  await AsyncStorage.removeItem(account_preferences_key(uid));
}
