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
  const listeners = new Set<(entitlement: Entitlement, userId: string) => void>();
  let generation = 0;
  let intendedUser: string | null = null;
  let identifiedUser: string | null = null;
  let identityQueue: Promise<void> = Promise.resolve();
  // Identity mutations must finish in order: a slow logout must not sign out the next account.
  function serializeIdentity<T>(operation: () => Promise<T>): Promise<T> {
    const result = identityQueue.then(operation);
    identityQueue = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  const toEntitlement = (info: CustomerInfo): Entitlement => entitlementFromCustomerInfo(info, entitlementId);
  // RevenueCat is started on first use (normally identify, with the signed-in account's id), so it never
  // creates an anonymous customer just because the app opened.
  function load(userId?: string) {
    sdkPromise ??= import("react-native-purchases").then(({ default: Purchases }) => {
      Purchases.configure({ apiKey, appUserID: userId ?? null });
      Purchases.addCustomerInfoUpdateListener(() => {
        const owner = identifiedUser;
        const token = generation;
        if (!owner) return;
        // Native events can be queued for a previous customer. Treat them as a signal to re-read the
        // SDK's CURRENT identified customer, rather than attaching the event's payload to our account.
        void identityQueue
          .then(async () => {
            if (
              token !== generation ||
              owner !== identifiedUser ||
              (await Purchases.getAppUserID()) !== owner
            )
              return;
            const info = await Purchases.getCustomerInfo();
            if (token !== generation || owner !== identifiedUser) return;
            const entitlement = toEntitlement(info);
            listeners.forEach((listener) => listener(entitlement, owner));
          })
          .catch(() => {});
      });
      return Purchases;
    });
    return sdkPromise;
  }
  async function safely(read: (sdk: Sdk) => Promise<CustomerInfo>) {
    const owner = intendedUser;
    const token = generation;
    try {
      await identityQueue;
      if (!owner || token !== generation) return UNKNOWN_ENTITLEMENT;
      // A temporary login failure must not make Retry and Restore permanently unavailable.
      // Serialize recovery with account changes, and never retry an account that has signed out.
      if (identifiedUser !== owner) {
        await serializeIdentity(async () => {
          if (token !== generation || owner !== intendedUser || identifiedUser === owner) return;
          const sdk = await load(owner);
          if (token !== generation || owner !== intendedUser) return;
          await sdk.logIn(owner);
          if (token === generation && owner === intendedUser) identifiedUser = owner;
        });
      }
      if (token !== generation || owner !== identifiedUser) return UNKNOWN_ENTITLEMENT;
      const sdk = await load();
      if ((await sdk.getAppUserID()) !== owner) return UNKNOWN_ENTITLEMENT;
      const info = await read(sdk);
      return token === generation && owner === identifiedUser ? toEntitlement(info) : UNKNOWN_ENTITLEMENT;
    } catch {
      return UNKNOWN_ENTITLEMENT;
    }
  }

  return {
    unavailableReason: null,
    async identify(userId) {
      const token = ++generation;
      intendedUser = userId;
      identifiedUser = null;
      packages.clear();
      return serializeIdentity(async () => {
        try {
          const sdk = await load(userId);
          const info = (await sdk.logIn(userId)).customerInfo;
          if (token !== generation) return UNKNOWN_ENTITLEMENT;
          identifiedUser = userId;
          return toEntitlement(info);
        } catch {
          return UNKNOWN_ENTITLEMENT;
        }
      });
    },
    async reset() {
      ++generation;
      intendedUser = null;
      identifiedUser = null;
      packages.clear();
      await serializeIdentity(async () => {
        try {
          const sdk = await load();
          if (!(await sdk.isAnonymous())) await sdk.logOut();
        } catch {
          /* Nothing to forget. */
        }
      });
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
      const token = generation;
      const owner = identifiedUser;
      const item = packages.get(planId);
      if (!item || !owner)
        return { kind: "failed", message: "This plan isn't available right now. Please try again." };
      try {
        await identityQueue;
        const sdk = await load();
        if (token !== generation || (await sdk.getAppUserID()) !== owner) return { kind: "cancelled" };
        const { customerInfo } = await sdk.purchasePackage(item);
        if (token !== generation || owner !== identifiedUser) return { kind: "cancelled" };
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
