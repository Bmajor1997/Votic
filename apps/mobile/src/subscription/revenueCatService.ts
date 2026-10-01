import { Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { entitlementFromCustomerInfo, planFromStoreProduct, purchaseOutcomeFromError } from "./entitlement";
import { Entitlement, SubscriptionService, UNKNOWN_ENTITLEMENT } from "./subscriptionTypes";

type Sdk = typeof import("react-native-purchases").default;

/**
 * Subscriptions through RevenueCat, which uses the official App Store and Google Play purchase sheets.
 * Votic never sees card details. Access is read from RevenueCat's entitlement, which RevenueCat verifies
 * with the store, so it survives reinstalls and follows the account to other devices.
 */
export function createRevenueCatService(apiKey: string, entitlementId: string): SubscriptionService {
  let sdkPromise: Promise<Sdk> | null = null;
  const packages = new Map<string, PurchasesPackage>();
  const listeners = new Set<(entitlement: Entitlement) => void>();
  const toEntitlement = (info: CustomerInfo): Entitlement => entitlementFromCustomerInfo(info, entitlementId);
  // RevenueCat is started on first use (normally identify, with the signed-in account's id), so it never
  // creates an anonymous customer just because the app opened.
  function load(userId?: string) {
    sdkPromise ??= import("react-native-purchases").then(({ default: Purchases }) => {
      Purchases.configure({ apiKey, appUserID: userId ?? null });
      Purchases.addCustomerInfoUpdateListener((info) => {
        const entitlement = toEntitlement(info);
        listeners.forEach((listener) => listener(entitlement));
      });
      return Purchases;
    });
    return sdkPromise;
  }
  async function safely(read: (sdk: Sdk) => Promise<CustomerInfo>) {
    try {
      return toEntitlement(await read(await load()));
    } catch {
      return UNKNOWN_ENTITLEMENT;
    }
  }

  return {
    unavailableReason: null,
    async identify(userId) {
      try {
        const sdk = await load(userId);
        return toEntitlement((await sdk.logIn(userId)).customerInfo);
      } catch {
        return UNKNOWN_ENTITLEMENT;
      }
    },
    async reset() {
      try {
        const sdk = await load();
        if (!(await sdk.isAnonymous())) await sdk.logOut();
      } catch {
        // Nothing to forget.
      }
      packages.clear();
    },
    async refresh() {
      return safely((sdk) => sdk.getCustomerInfo());
    },
    async getPlans() {
      const sdk = await load();
      const offerings = await sdk.getOfferings();
      packages.clear();
      const available = offerings.current?.availablePackages || [];
      // Google Play only offers a free phase to people who are eligible for it. The App Store lists the
      // trial for everyone, so on iOS the trial is shown only when StoreKit confirms this person can get it
      // (RevenueCat's guidance is to show regular pricing when eligibility is unknown).
      let eligibleOnIos: Set<string> | null = null;
      if (Platform.OS === "ios" && available.length) {
        const ELIGIBLE = sdk.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
        const eligibility = await sdk
          .checkTrialOrIntroductoryPriceEligibility(available.map((item) => item.product.identifier))
          .catch(() => ({}) as Record<string, { status: number }>);
        eligibleOnIos = new Set(
          Object.entries(eligibility)
            .filter(([, value]) => value?.status === ELIGIBLE)
            .map(([id]) => id),
        );
      }
      return available.map((item) => {
        packages.set(item.identifier, item);
        const plan = planFromStoreProduct(item.identifier, {
          ...item.product,
          freePhase: item.product.defaultOption?.freePhase ?? null,
        });
        return eligibleOnIos && !eligibleOnIos.has(item.product.identifier) ? { ...plan, trial: null } : plan;
      });
    },
    async purchase(planId) {
      const item = packages.get(planId);
      if (!item) return { kind: "failed", message: "This plan isn't available right now. Please try again." };
      try {
        const sdk = await load();
        const { customerInfo } = await sdk.purchasePackage(item);
        return { kind: "purchased", entitlement: toEntitlement(customerInfo) };
      } catch (error) {
        return purchaseOutcomeFromError(error);
      }
    },
    async restore() {
      return safely((sdk) => sdk.restorePurchases());
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
