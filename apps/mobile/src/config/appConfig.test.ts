import { describe, expect, it } from "vitest";
import { legal_links_from, revenue_cat_config_from } from "./appConfig";

describe("build configuration", () => {
  it("defaults the RevenueCat entitlement id", () => {
    expect(revenue_cat_config_from({})).toEqual({
      iosApiKey: null,
      androidApiKey: null,
      entitlementId: "pro",
    });
  });
  it("only shows HTTPS legal links and never invents them", () => {
    expect(legal_links_from({})).toEqual({ termsUrl: null, privacyUrl: null });
    expect(
      legal_links_from({
        EXPO_PUBLIC_VOTIC_TERMS_URL: "http://votic.app/terms",
        EXPO_PUBLIC_VOTIC_PRIVACY_URL: "https://votic.app/privacy",
      }),
    ).toEqual({ termsUrl: null, privacyUrl: "https://votic.app/privacy" });
  });
});
