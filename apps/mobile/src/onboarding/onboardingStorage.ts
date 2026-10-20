import AsyncStorage from "@react-native-async-storage/async-storage";
import { write_account_data } from "../storage/accountDeletion";
import { OnboardingState, parse_onboarding_state } from "./onboardingModel";

/**
 * Account setup (personalization answers, where setup stopped, and whether it's finished) is saved per
 * account, so another account signing in on this device starts its own setup.
 */
const ACCOUNT_SETUP_KEY_PREFIX = "votic.mobile.onboarding.v1:";

export async function load_account_setup(userId: string) {
  return parse_onboarding_state(await AsyncStorage.getItem(ACCOUNT_SETUP_KEY_PREFIX + userId));
}

export async function save_account_setup(userId: string, state: OnboardingState) {
  await write_account_data(userId, () =>
    AsyncStorage.setItem(ACCOUNT_SETUP_KEY_PREFIX + userId, JSON.stringify(state)),
  );
}

export async function remove_account_setup(userId: string) {
  await AsyncStorage.removeItem(ACCOUNT_SETUP_KEY_PREFIX + userId);
}
