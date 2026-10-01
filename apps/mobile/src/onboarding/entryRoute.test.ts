import { describe, expect, it } from "vitest";
import { EntryInput, resolveEntryRoute } from "./entryRoute";
import { newOnboardingState } from "./onboardingModel";

const verified = { uid: "u1", email: "sam@example.com", firstName: "Sam", emailVerified: true };
const personalized = { ...newOnboardingState(), personalizationCompletedAt: 1 };
const base: EntryInput = {
  hydrated: true,
  deviceHistory: "new",
  user: verified,
  onboarding: personalized,
  entitlement: "none",
  checkingEntitlement: false,
  developmentBypass: { account: false, paywall: false },
  accountsAvailable: true,
  subscriptionsAvailable: true,
};
const route = (change: Partial<EntryInput>) => resolveEntryRoute({ ...base, ...change });

describe("where Votic opens", () => {
  it("waits for saved state before deciding", () => {
    expect(route({ hydrated: false })).toBe("loading");
    expect(route({ deviceHistory: null })).toBe("loading");
    expect(route({ onboarding: null })).toBe("loading");
  });
  it("shows Welcome when signed out and verification before anything else", () => {
    expect(route({ user: null })).toBe("welcome");
    expect(route({ user: { ...verified, emailVerified: false } })).toBe("verify-email");
  });
  it("resumes personalization until it's finished or skipped", () => {
    expect(route({ onboarding: newOnboardingState() })).toBe("personalize");
  });
  it("shows the paywall after personalization without a trial or subscription", () => {
    for (const entitlement of ["none", "expired", "unknown"] as const)
      expect(route({ entitlement })).toBe("paywall");
  });
  it("never treats finished onboarding as proof of a subscription", () => {
    expect(route({ onboarding: { ...personalized, completedAt: 5 }, entitlement: "none" })).toBe("paywall");
  });
  it("lets active trials and subscriptions in, including cancelled-but-paid and grace periods", () => {
    const done = { ...personalized, completedAt: 5 };
    for (const entitlement of ["trial", "active", "cancelled-active", "billing-issue"] as const)
      expect(route({ onboarding: done, entitlement })).toBe("app");
    expect(route({ entitlement: "trial" })).toBe("ready");
  });
  it("waits while a returning subscriber's status is checked instead of flashing the paywall", () => {
    expect(route({ checkingEntitlement: true })).toBe("loading");
  });
  it("lets existing installs in without personalization or the paywall", () => {
    expect(route({ deviceHistory: "existing", onboarding: newOnboardingState(), entitlement: "none" })).toBe(
      "app",
    );
    expect(route({ deviceHistory: "existing", user: null })).toBe("welcome");
  });
  it("only uses development bypasses when the service isn't configured", () => {
    const bypass = { account: true, paywall: true };
    expect(route({ developmentBypass: bypass, entitlement: "none" })).toBe("paywall");
    expect(route({ developmentBypass: bypass, subscriptionsAvailable: false })).toBe("app");
    expect(route({ accountsAvailable: false, user: null })).toBe("welcome");
    expect(route({ accountsAvailable: false, user: null, developmentBypass: bypass })).toBe("app");
  });
});
