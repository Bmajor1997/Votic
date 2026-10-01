import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceHistory } from "./entryRoute";
import { OnboardingState, parseOnboardingState } from "./onboardingModel";

export const DEVICE_HISTORY_KEY = "votic.mobile.device-history.v1";
const ONBOARDING_KEY_PREFIX = "votic.mobile.onboarding.v1:";
const DEVELOPMENT_BYPASS_KEY = "votic.mobile.development-bypass.v1";

/**
 * Data only a person using Votic creates: documents, collections, a chosen purpose, or a finished or
 * migrated first-run tour. Theme and accessibility keys are left out because the app writes their
 * defaults on first launch, so they can't tell a new install from an existing one. For the same reason
 * an empty list (which the library saves on first launch) doesn't count.
 */
export const EXISTING_USER_KEYS = [
  "votic.mobile.documents.v1",
  "votic.mobile.library.v2",
  "votic.mobile.collections.v1",
  "votic.mobile.purpose.v1",
  "votic.mobile.first-run-tour.v1",
];

function hasUserData(value: string | null) {
  if (value === null || !value.trim()) return false;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length > 0 : true;
  } catch {
    return true;
  }
}

/**
 * Whether this device used Votic before accounts were added. Decided on the first launch of this version
 * and stored, so later launches (after new documents are added) keep the same answer.
 */
export async function loadDeviceHistory(): Promise<DeviceHistory> {
  const saved = await AsyncStorage.getItem(DEVICE_HISTORY_KEY);
  if (saved === "existing" || saved === "new") return saved;
  const existing = await AsyncStorage.multiGet(EXISTING_USER_KEYS);
  const history: DeviceHistory = existing.some(([, value]) => hasUserData(value)) ? "existing" : "new";
  await AsyncStorage.setItem(DEVICE_HISTORY_KEY, history);
  return history;
}

export async function loadOnboardingState(userId: string) {
  return parseOnboardingState(await AsyncStorage.getItem(ONBOARDING_KEY_PREFIX + userId));
}

export async function saveOnboardingState(userId: string, state: OnboardingState) {
  await AsyncStorage.setItem(ONBOARDING_KEY_PREFIX + userId, JSON.stringify(state));
}

export async function removeOnboardingState(userId: string) {
  await AsyncStorage.removeItem(ONBOARDING_KEY_PREFIX + userId);
}

export type DevelopmentBypass = { account: boolean; paywall: boolean };
const NO_BYPASS: DevelopmentBypass = { account: false, paywall: false };

/** Development builds only; release builds always ignore this. */
export async function loadDevelopmentBypass(isDevelopment: boolean): Promise<DevelopmentBypass> {
  if (!isDevelopment) return NO_BYPASS;
  try {
    const value = JSON.parse((await AsyncStorage.getItem(DEVELOPMENT_BYPASS_KEY)) || "{}");
    return { account: value?.account === true, paywall: value?.paywall === true };
  } catch {
    return NO_BYPASS;
  }
}

export async function saveDevelopmentBypass(value: DevelopmentBypass) {
  await AsyncStorage.setItem(DEVELOPMENT_BYPASS_KEY, JSON.stringify(value));
}
