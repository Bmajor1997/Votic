import { describe, expect, it } from "vitest";
import { legalLinksFrom, revenueCatConfigFrom } from "./appConfig";

describe("build configuration", () => {
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
