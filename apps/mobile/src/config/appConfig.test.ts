import { describe, expect, it } from "vitest";
import { firebaseConfigFrom, legalLinksFrom, revenueCatConfigFrom } from "./appConfig";

describe("build configuration", () => {
  it("treats a partial Firebase config as accounts not set up", () => {
    expect(firebaseConfigFrom({ EXPO_PUBLIC_FIREBASE_API_KEY: "key" })).toBeNull();
    expect(
      firebaseConfigFrom({
        EXPO_PUBLIC_FIREBASE_API_KEY: " key ",
        EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "votic.firebaseapp.com",
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: "votic",
        EXPO_PUBLIC_FIREBASE_APP_ID: "1:2:ios:3",
      }),
    ).toEqual({ apiKey: "key", authDomain: "votic.firebaseapp.com", projectId: "votic", appId: "1:2:ios:3" });
  });
  it("defaults the RevenueCat entitlement id", () => {
    expect(revenueCatConfigFrom({})).toEqual({ iosApiKey: null, androidApiKey: null, entitlementId: "pro" });
  });
  it("only shows HTTPS legal links and never invents them", () => {
    expect(legalLinksFrom({})).toEqual({ termsUrl: null, privacyUrl: null });
    expect(
      legalLinksFrom({
        EXPO_PUBLIC_VOTIC_TERMS_URL: "http://votic.app/terms",
        EXPO_PUBLIC_VOTIC_PRIVACY_URL: "https://votic.app/privacy",
      }),
    ).toEqual({ termsUrl: null, privacyUrl: "https://votic.app/privacy" });
  });
});
