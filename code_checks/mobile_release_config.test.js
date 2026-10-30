import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { validate_release_environment, public_https } = createRequire(import.meta.url)("../security/check-mobile-release.cjs");
test("production configuration rejects missing services, local addresses and embedded URL credentials", () => {
  assert.throws(() => validate_release_environment({}), /Production configuration/);
  for (const url of ["http://api.example.com", "https://localhost", "https://10.0.0.2", "https://192.168.1.2", "https://[::1]", "https://user:pass@example.com"])
    assert.equal(public_https(url), false, url);
  const env = {
    EXPO_PUBLIC_FIREBASE_API_KEY: "test-only", EXPO_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
    EXPO_PUBLIC_FIREBASE_APP_ID: "test-app", EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_fixtureOnly",
    EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: "premium",
    EXPO_PUBLIC_VOTIC_API_URL: "https://api.example.com", EXPO_PUBLIC_VOTIC_TERMS_URL: "https://example.com/terms",
    EXPO_PUBLIC_VOTIC_PRIVACY_URL: "https://example.com/privacy", EAS_PROJECT_ID: "00000000-0000-4000-8000-000000000000",
  };
  assert.doesNotThrow(() => validate_release_environment(env));
  for (const key of ["test_fixtureOnly", "sk_fixtureOnly", "appl_fixtureOnly", "goog_", " goog_fixtureOnly"])
    assert.throws(() => validate_release_environment({ ...env, EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: key }), /Google Play RevenueCat/);
  assert.throws(() => validate_release_environment({ ...env, EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: "" }), /EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID/);
});
