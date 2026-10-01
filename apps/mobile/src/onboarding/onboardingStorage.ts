import AsyncStorage from "@react-native-async-storage/async-storage";
import { OnboardingState, parseOnboardingState } from "./onboardingModel";

/**
 * Account setup (personalization answers, where setup stopped, and whether it's finished) is saved per
 * account, so another account signing in on this device starts its own setup.
 */
const ACCOUNT_SETUP_KEY_PREFIX = "votic.mobile.onboarding.v1:";

export async function loadAccountSetup(userId: string) {
  return parseOnboardingState(await AsyncStorage.getItem(ACCOUNT_SETUP_KEY_PREFIX + userId));
}

export async function saveAccountSetup(userId: string, state: OnboardingState) {
  await AsyncStorage.setItem(ACCOUNT_SETUP_KEY_PREFIX + userId, JSON.stringify(state));
}

export async function removeAccountSetup(userId: string) {
  await AsyncStorage.removeItem(ACCOUNT_SETUP_KEY_PREFIX + userId);
}
