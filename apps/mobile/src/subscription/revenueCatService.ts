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
      return (offerings.current?.availablePackages || []).map((item) => {
        packages.set(item.identifier, item);
        return planFromStoreProduct(item.identifier, {
          ...item.product,
          freePhase: item.product.defaultOption?.freePhase ?? null,
        });
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
