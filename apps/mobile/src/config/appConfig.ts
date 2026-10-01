/**
 * Build-time configuration for accounts, subscriptions, and legal links.
 *
 * Every value here is public: Firebase web config and RevenueCat public SDK keys are designed to ship
 * inside apps. Secrets (server keys, RevenueCat secret keys, Google/Apple private keys) never belong here.
 * Expo only inlines EXPO_PUBLIC_* variables that are read as literal `process.env.EXPO_PUBLIC_…` expressions.
 */
export type FirebaseConfig = { apiKey: string; authDomain: string; projectId: string; appId: string };
export type RevenueCatConfig = {
  iosApiKey: string | null;
  androidApiKey: string | null;
  entitlementId: string;
};
export type LegalLinks = { termsUrl: string | null; privacyUrl: string | null };

type Env = Record<string, string | undefined>;

function clean(value: string | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

/** Firebase needs all four values; a partial config is treated as "accounts not set up". */
export function firebaseConfigFrom(env: Env): FirebaseConfig | null {
  const apiKey = clean(env.EXPO_PUBLIC_FIREBASE_API_KEY);
  const authDomain = clean(env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const projectId = clean(env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  const appId = clean(env.EXPO_PUBLIC_FIREBASE_APP_ID);
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;
}

export function revenueCatConfigFrom(env: Env): RevenueCatConfig {
  return {
    iosApiKey: clean(env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY),
    androidApiKey: clean(env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY),
    entitlementId: clean(env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID) || "pro",
  };
}

/** Only HTTPS links are shown; anything else is treated as not configured rather than guessed. */
export function legalLinksFrom(env: Env): LegalLinks {
  const https = (value: string | undefined) => {
    const url = clean(value);
    return url && /^https:\/\//i.test(url) ? url : null;
  };
  return {
    termsUrl: https(env.EXPO_PUBLIC_VOTIC_TERMS_URL),
    privacyUrl: https(env.EXPO_PUBLIC_VOTIC_PRIVACY_URL),
  };
}

/** The app's environment, read with literal expressions so Expo can inline them at build time. */
export function appEnv(): Env {
  return {
    EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID,
    EXPO_PUBLIC_VOTIC_TERMS_URL: process.env.EXPO_PUBLIC_VOTIC_TERMS_URL,
    EXPO_PUBLIC_VOTIC_PRIVACY_URL: process.env.EXPO_PUBLIC_VOTIC_PRIVACY_URL,
  };
}
