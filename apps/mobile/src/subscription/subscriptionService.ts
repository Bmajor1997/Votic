import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { app_env, LegalLinks, legal_links_from, revenue_cat_config_from } from "../config/appConfig";
import { create_revenue_cat_service } from "./revenueCatService";
import { SubscriptionService, unavailable_subscription_service } from "./subscriptionTypes";

/**
 * Real RevenueCat purchases when this build is configured for them, and an honest "not available" service
 * otherwise (never a simulated purchase). Tests replace this module with an in-memory fake.
 */
export function create_subscription_service(): SubscriptionService {
  const config = revenue_cat_config_from(app_env());
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    return unavailable_subscription_service("unsupported-platform");
  // Expo Go can't make real store purchases (RevenueCat only simulates them there), so it never offers them.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return unavailable_subscription_service("expo-go");
  const apiKey = Platform.OS === "ios" ? config.iosApiKey : config.androidApiKey;
  if (!apiKey) return unavailable_subscription_service("not-configured");
  return create_revenue_cat_service(apiKey, config.entitlementId);
}

export function legal_links(): LegalLinks {
  return legal_links_from(app_env());
}
