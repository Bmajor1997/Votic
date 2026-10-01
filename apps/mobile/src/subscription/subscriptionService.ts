import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { appEnv, LegalLinks, legalLinksFrom, revenueCatConfigFrom } from "../config/appConfig";
import { createRevenueCatService } from "./revenueCatService";
import { SubscriptionService, unavailableSubscriptionService } from "./subscriptionTypes";

/**
 * Real RevenueCat purchases when this build is configured for them, and an honest "not available" service
 * otherwise (never a simulated purchase). Tests replace this module with an in-memory fake.
 */
export function createSubscriptionService(): SubscriptionService {
  const config = revenueCatConfigFrom(appEnv());
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    return unavailableSubscriptionService("unsupported-platform");
  // Expo Go can't make real store purchases (RevenueCat only simulates them there), so it never offers them.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return unavailableSubscriptionService("expo-go");
  const apiKey = Platform.OS === "ios" ? config.iosApiKey : config.androidApiKey;
  if (!apiKey) return unavailableSubscriptionService("not-configured");
  return createRevenueCatService(apiKey, config.entitlementId);
}

export function legalLinks(): LegalLinks {
  return legalLinksFrom(appEnv());
}
