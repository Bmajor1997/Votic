import type { AccountUser } from "../auth/authTypes";
import { hasAccess } from "../subscription/entitlement";
import type { EntitlementStatus } from "../subscription/subscriptionTypes";
import type { OnboardingState } from "./onboardingModel";

/**
 * Whether this device had Votic data before accounts existed. Detected once and remembered.
 * "existing" devices skip personalization and the paywall (grandfathered until a pricing decision is made).
 */
export type DeviceHistory = "existing" | "new";

export type EntryRoute =
  | "loading"
  | "welcome" // signed out: Welcome, Create Account, Sign In, Forgot Password
  | "verify-email"
  | "personalize"
  | "paywall"
  | "ready" // "Votic is ready for you" after a trial or subscription starts
  | "app";

export type EntryInput = {
  hydrated: boolean;
  deviceHistory: DeviceHistory | null;
  user: AccountUser | null;
  onboarding: OnboardingState | null;
  entitlement: EntitlementStatus;
  /** True while the store is being asked about this account's subscription. */
  checkingEntitlement: boolean;
  /** Development builds only: lets testers past account or paywall screens when those services aren't configured. */
  developmentBypass: { account: boolean; paywall: boolean };
  accountsAvailable: boolean;
  subscriptionsAvailable: boolean;
};

/**
 * Decides which part of Votic to show. Signing in, finishing onboarding, and having a subscription are
 * separate facts: finishing onboarding alone never grants paid access.
 */
export function resolveEntryRoute(input: EntryInput): EntryRoute {
  if (!input.hydrated || !input.deviceHistory) return "loading";
  if (!input.accountsAvailable) return input.developmentBypass.account ? "app" : "welcome";
  const { user, onboarding } = input;
  if (!user) return "welcome";
  if (!user.emailVerified) return "verify-email";
  if (input.deviceHistory === "existing") return "app";
  if (!onboarding) return "loading";
  if (!onboarding.personalizationCompletedAt) return "personalize";
  const paid = hasAccess(input.entitlement);
  if (!paid) {
    if (!input.subscriptionsAvailable && input.developmentBypass.paywall) return "app";
    // While a returning subscriber's status is still being checked, wait rather than flash the paywall.
    if (input.checkingEntitlement) return "loading";
    return "paywall";
  }
  return onboarding.completedAt ? "app" : "ready";
}
