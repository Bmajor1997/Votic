import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { AuthService, unavailableAuthService } from "../auth/authTypes";
import { createFirebaseAuthService } from "../auth/firebaseAuthService";
import { createRevenueCatService } from "../subscription/revenueCatService";
import { SubscriptionService, unavailableSubscriptionService } from "../subscription/subscriptionTypes";
import { appEnv, firebaseConfigFrom, LegalLinks, legalLinksFrom, revenueCatConfigFrom } from "./appConfig";

export type AppServices = { auth: AuthService; subscriptions: SubscriptionService; legal: LegalLinks };

/**
 * Chooses real services when this build is configured for them, and honest "not set up" services otherwise.
 * Tests replace this module to provide fakes.
 */
export function createAppServices(): AppServices {
  const env = appEnv();
  const firebase = firebaseConfigFrom(env);
  const revenueCat = revenueCatConfigFrom(env);
  const apiKey =
    Platform.OS === "ios"
      ? revenueCat.iosApiKey
      : Platform.OS === "android"
        ? revenueCat.androidApiKey
        : null;
  let subscriptions: SubscriptionService;
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    subscriptions = unavailableSubscriptionService("unsupported-platform");
  // Expo Go can't make real store purchases (RevenueCat only simulates them there), so it never offers them.
  else if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    subscriptions = unavailableSubscriptionService("expo-go");
  else if (!apiKey) subscriptions = unavailableSubscriptionService("not-configured");
  else subscriptions = createRevenueCatService(apiKey, revenueCat.entitlementId);
  return {
    auth: firebase ? createFirebaseAuthService(firebase) : unavailableAuthService,
    subscriptions,
    legal: legalLinksFrom(env),
  };
}
