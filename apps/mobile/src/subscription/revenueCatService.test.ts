import { beforeEach, expect, it, vi } from "vitest";
import { Platform } from "react-native";
import Purchases, { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { create_revenue_cat_service, retention_offer_from } from "./revenueCatService";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

vi.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    configure: vi.fn(),
    addCustomerInfoUpdateListener: vi.fn(),
    logIn: vi.fn(),
    logOut: vi.fn(),
    isAnonymous: vi.fn(),
    getAppUserID: vi.fn(),
    getCustomerInfo: vi.fn(),
    restorePurchases: vi.fn(),
    getOfferings: vi.fn(),
    getProducts: vi.fn(),
    PRODUCT_CATEGORY: { SUBSCRIPTION: "SUBS", NON_SUBSCRIPTION: "NON_SUBSCRIPTION" },
    purchasePackage: vi.fn(),
    purchaseStoreProduct: vi.fn(),
    purchaseSubscriptionOption: vi.fn(),
    STORE_REPLACEMENT_MODE: { WITH_TIME_PRORATION: "WITH_TIME_PRORATION", DEFERRED: "DEFERRED" },
    checkTrialOrIntroductoryPriceEligibility: vi.fn(),
    INTRO_ELIGIBILITY_STATUS: { INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2 },
  },
}));

const sdk = vi.mocked(Purchases);
function info(active: boolean): CustomerInfo {
  const pro = {
    isActive: true,
    willRenew: true,
    periodType: "NORMAL",
    expirationDateMillis: null,
    billingIssueDetectedAt: null,
  };
  return {
    entitlements: { active: active ? { pro } : {}, all: active ? { pro } : {} },
    managementURL: null,
  } as unknown as CustomerInfo;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(Platform, { OS: "android" });
  sdk.isAnonymous.mockResolvedValue(false);
  sdk.logOut.mockResolvedValue(info(false));
});

it.each(["identify", "reset", "refresh"])("discards cached retention eligibility on %s", async (change) => {
  let owner = "a";
  sdk.logIn.mockImplementation(async (uid) => {
    owner = uid;
    return { customerInfo: info(false), created: false };
  });
  sdk.getAppUserID.mockImplementation(async () => owner);
  const regular = { price: { amountMicros: 9990000, formatted: "$9.99" }, billingPeriod: { iso8601: "P1M" } };
  const option = {
    id: "monthly:stay",
    tags: ["votic-retention"],
    fullPricePhase: regular,
    pricingPhases: [
      {
        recurrenceMode: 2,
        billingCycleCount: 2,
        price: { amountMicros: 7990000, formatted: "$7.99" },
        billingPeriod: { iso8601: "P1M" },
      },
    ],
  };
  sdk.getOfferings.mockResolvedValue({
    current: { availablePackages: [{ product: { identifier: "plus", subscriptionOptions: [option] } }] },
  } as never);
  const service = create_revenue_cat_service("public-key", "pro");
  await service.identify("a");
  expect(await service.get_retention_offer?.()).toMatchObject({ id: "monthly:stay" });
  if (change === "reset") await service.reset();
  if (change !== "refresh") await service.identify("b");
  else {
    sdk.getOfferings.mockResolvedValue({ current: { availablePackages: [] } } as never);
    expect(await service.get_retention_offer?.()).toBeNull();
  }
  expect(await service.claim_retention_offer?.("monthly:stay", null)).toMatchObject({ kind: "failed" });
  expect(sdk.purchaseSubscriptionOption).not.toHaveBeenCalled();
});

it.each(["refresh", "restore"] as const)(
  "%s retries identification after a temporary login failure",
  async (action) => {
    sdk.logIn.mockRejectedValueOnce(new Error("offline"));
    const service = create_revenue_cat_service("public-key", "pro");
    expect((await service.identify("a")).status).toBe("unknown");
    sdk.logIn.mockResolvedValue({ customerInfo: info(true), created: false });
    sdk.getAppUserID.mockResolvedValue("a");
    sdk.getCustomerInfo.mockResolvedValue(info(true));
    sdk.restorePurchases.mockResolvedValue(info(true));
    expect((await service[action]()).status).toBe("active");
    expect(sdk.logIn).toHaveBeenCalledTimes(2);
    expect(action === "refresh" ? sdk.getCustomerInfo : sdk.restorePurchases).toHaveBeenCalledTimes(1);
  },
);

it("keeps recovery retryable when the next identification attempt also fails", async () => {
  sdk.logIn.mockRejectedValue(new Error("offline"));
  const service = create_revenue_cat_service("public-key", "pro");
  await service.identify("a");
  expect((await service.refresh()).status).toBe("unknown");
  sdk.logIn.mockResolvedValue({ customerInfo: info(true), created: false });
  sdk.getAppUserID.mockResolvedValue("a");
  sdk.getCustomerInfo.mockResolvedValue(info(true));
  expect((await service.refresh()).status).toBe("active");
});

it.each(["reset", "switch"] as const)(
  "discards recovery when the account changes through %s",
  async (action) => {
    sdk.logIn.mockRejectedValueOnce(new Error("offline"));
    const service = create_revenue_cat_service("public-key", "pro");
    await service.identify("a");
    const recovery = deferred<{ customerInfo: CustomerInfo; created: boolean }>();
    sdk.logIn.mockReturnValueOnce(recovery.promise);
    const refresh = service.refresh();
    await flush();
    expect(sdk.logIn).toHaveBeenCalledTimes(2);
    sdk.logIn.mockResolvedValue({ customerInfo: info(false), created: false });
    const changing = action === "reset" ? service.reset() : service.identify("b");
    recovery.resolve({ customerInfo: info(true), created: false });
    expect((await refresh).status).toBe("unknown");
    await changing;
    expect(sdk.getCustomerInfo).not.toHaveBeenCalled();
    if (action === "reset") {
      expect((await service.restore()).status).toBe("unknown");
      expect(sdk.logIn).toHaveBeenCalledTimes(2);
    } else expect(sdk.logIn).toHaveBeenLastCalledWith("b");
  },
);

it("re-reads the identified customer instead of applying a queued native payload from the old account", async () => {
  let owner = "a";
  sdk.logIn.mockImplementation(async (uid) => {
    owner = uid;
    return { customerInfo: info(uid === "a"), created: false };
  });
  sdk.getAppUserID.mockImplementation(async () => owner);
  sdk.getCustomerInfo.mockImplementation(async () => info(owner === "a"));
  const service = create_revenue_cat_service("public-key", "pro");
  const changed = vi.fn();
  service.on_change(changed);
  await service.identify("a");
  await service.identify("b");
  sdk.addCustomerInfoUpdateListener.mock.calls[0][0](info(true));
  await flush();
  expect(changed).toHaveBeenCalledWith(expect.objectContaining({ status: "none" }), "b");
  expect(changed).not.toHaveBeenCalledWith(expect.objectContaining({ status: "active" }), "b");
});

it("finishes a slow logout before logging into the next account", async () => {
  const logout = deferred<CustomerInfo>();
  sdk.logIn.mockResolvedValue({ customerInfo: info(false), created: false });
  sdk.logOut.mockReturnValue(logout.promise);
  const service = create_revenue_cat_service("public-key", "pro");
  await service.identify("a");
  const resetting = service.reset();
  await flush();
  expect(sdk.logOut).toHaveBeenCalledTimes(1);
  const identifying = service.identify("b");
  await flush();
  expect(sdk.logIn).toHaveBeenCalledTimes(1);
  logout.resolve(info(false));
  await resetting;
  expect((await identifying).status).toBe("none");
  expect(sdk.logIn).toHaveBeenLastCalledWith("b");
});

it("discards an in-flight customer read when identity changes", async () => {
  const reading = deferred<CustomerInfo>();
  let owner = "a";
  sdk.logIn.mockImplementation(async (uid) => {
    owner = uid;
    return { customerInfo: info(false), created: false };
  });
  sdk.getAppUserID.mockImplementation(async () => owner);
  sdk.getCustomerInfo.mockReturnValue(reading.promise);
  const service = create_revenue_cat_service("public-key", "pro");
  await service.identify("a");
  const refresh = service.refresh();
  await flush();
  expect(sdk.getCustomerInfo).toHaveBeenCalledTimes(1);
  await service.identify("b");
  reading.resolve(info(true));
  expect((await refresh).status).toBe("unknown");
});

function offer() {
  return {
    identifier: "monthly",
    product: {
      identifier: "pro_monthly",
      priceString: "9,99 €",
      price: 9.99,
      currencyCode: "EUR",
      subscriptionPeriod: "P1M",
      introPrice: { price: 0, priceString: "0,00 €", periodUnit: "DAY", periodNumberOfUnits: 7, cycles: 1 },
      defaultOption: {
        freePhase: { billingPeriod: { unit: "DAY", value: 7 }, billingCycleCount: 1 },
        pricingPhases: [
          {
            recurrenceMode: 2,
            billingPeriod: { unit: "DAY", value: 7 },
            billingCycleCount: 1,
            price: { amountMicros: 0, formatted: "0,00 €" },
          },
          {
            recurrenceMode: 2,
            billingPeriod: { unit: "MONTH", value: 1 },
            billingCycleCount: 3,
            price: { amountMicros: 990000, formatted: "0,99 €" },
          },
          {
            recurrenceMode: 1,
            billingPeriod: { unit: "MONTH", value: 1 },
            billingCycleCount: 0,
            price: { amountMicros: 9990000, formatted: "9,99 €" },
          },
        ],
      },
    },
  } as unknown as PurchasesPackage;
}
function offerings(item = offer()) {
  sdk.getOfferings.mockResolvedValue({ current: { availablePackages: [item] } } as never);
}

it("shows Android's eligible free and paid phases, excludes regular renewal from introductory charges, and buys the shown package", async () => {
  offerings();
  sdk.logIn.mockResolvedValue({ customerInfo: info(false), created: false });
  sdk.getAppUserID.mockResolvedValue("a");
  sdk.purchasePackage.mockResolvedValue({ customerInfo: info(true) } as never);
  const service = create_revenue_cat_service("public-key", "pro");
  await service.identify("a");
  const [plan] = await service.get_plans();
  expect(plan.trial).toEqual({ count: 7, unit: "day" });
  expect(plan.introductoryPrices).toEqual([
    { priceString: "0,99 €", period: { count: 1, unit: "month" }, cycles: 3 },
  ]);
  expect((await service.purchase(plan.id)).kind).toBe("purchased");
  expect(sdk.purchasePackage).toHaveBeenCalledWith(expect.objectContaining({ identifier: "monthly" }));
  expect(sdk.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
});

it.each([2, 1, 0, "offline"])(
  "only shows iOS introductory terms with positive eligibility (%s)",
  async (status) => {
    Object.assign(Platform, { OS: "ios" });
    offerings();
    if (status === "offline")
      sdk.checkTrialOrIntroductoryPriceEligibility.mockRejectedValue(new Error("offline"));
    else sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ pro_monthly: { status } } as never);
    const service = create_revenue_cat_service("public-key", "pro");
    const [plan] = await service.get_plans();
    expect(plan.trial).toEqual(status === 2 ? { count: 7, unit: "day" } : null);
    expect(plan.introductoryPrices).toBeUndefined();
    expect(plan.priceString).toBe("9,99 €");
  },
);

it("hides a paid iOS introduction when eligibility cannot be confirmed", async () => {
  Object.assign(Platform, { OS: "ios" });
  const item = offer();
  offerings({
    ...item,
    product: {
      ...item.product,
      introPrice: { ...item.product.introPrice!, price: 0.99, priceString: "0,99 €" },
    },
  });
  sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ pro_monthly: { status: 0 } } as never);
  const service = create_revenue_cat_service("public-key", "pro");
  expect((await service.get_plans())[0].introductoryPrices).toBeUndefined();
});

it("discards offering eligibility results when the store account changes", async () => {
  Object.assign(Platform, { OS: "ios" });
  offerings();
  const eligibility = deferred<Record<string, { status: number }>>();
  sdk.checkTrialOrIntroductoryPriceEligibility.mockReturnValue(eligibility.promise as never);
  sdk.logIn.mockResolvedValue({ customerInfo: info(false), created: false });
  const service = create_revenue_cat_service("public-key", "pro");
  await service.identify("a");
  const plans = service.get_plans();
  await flush();
  await service.identify("b");
  eligibility.resolve({ pro_monthly: { status: 2 } });
  expect(await plans).toEqual([]);
});

it("reads upgrade prices without altering onboarding packages or trusting another account", async () => {
  const service = create_revenue_cat_service("key", "pro");
  sdk.logIn.mockResolvedValue({ customerInfo: info(true), created: false });
  sdk.getAppUserID.mockResolvedValue("a");
  await service.identify("a");
  sdk.getProducts.mockResolvedValue([
    { identifier: "plus", priceString: "€14,99", subscriptionPeriod: "P1M", introPrice: null } as never,
  ]);
  expect(await service.get_upgrade_plans?.(["plus"])).toMatchObject([
    { productId: "plus", priceString: "€14,99", trial: null },
  ]);
  expect(sdk.getProducts).toHaveBeenCalledWith(["plus"], "SUBS");
  sdk.getAppUserID.mockResolvedValue("other");
  expect(await service.get_upgrade_plans?.(["plus"])).toEqual([]);
});

it("offers only server-credited additional-usage products for the identified account, and buys the exact one", async () => {
  const service = create_revenue_cat_service("key", "pro");
  sdk.logIn.mockResolvedValue({ customerInfo: info(true), created: false });
  sdk.getAppUserID.mockResolvedValue("a");
  await service.identify("a");
  const product = { identifier: "votic_ai_100", title: "More AI usage", priceString: "$2.99" };
  sdk.getProducts.mockResolvedValue([product, { ...product, identifier: "unlisted" }] as never);
  expect(await service.get_credit_products?.(["votic_ai_100"])).toEqual([
    { productId: "votic_ai_100", title: "More AI usage", priceString: "$2.99" },
  ]);
  expect(sdk.getProducts).toHaveBeenCalledWith(["votic_ai_100"], "NON_SUBSCRIPTION");
  sdk.purchaseStoreProduct.mockResolvedValue({} as never);
  expect(await service.purchase_credits?.("votic_ai_100")).toEqual({ kind: "purchased" });
  expect(sdk.purchaseStoreProduct).toHaveBeenCalledWith(product);
  expect(await service.purchase_credits?.("unlisted")).toMatchObject({ kind: "failed" });
  sdk.purchaseStoreProduct.mockRejectedValue({ userCancelled: true });
  expect(await service.purchase_credits?.("votic_ai_100")).toEqual({ kind: "cancelled" });
  sdk.purchaseStoreProduct.mockRejectedValue({ code: "20" });
  expect(await service.purchase_credits?.("votic_ai_100")).toEqual({ kind: "pending" });
  sdk.purchaseStoreProduct.mockRejectedValue({ code: "10" });
  expect(await service.purchase_credits?.("votic_ai_100")).toMatchObject({ kind: "failed" });
  // Another account in the SDK never sees or buys this account's products.
  sdk.getAppUserID.mockResolvedValue("other");
  expect(await service.get_credit_products?.(["votic_ai_100"])).toEqual([]);
  expect(await service.purchase_credits?.("votic_ai_100")).toEqual({ kind: "cancelled" });
});

it("switches between monthly and annual through Google Play's replacement flow, never a second subscription", async () => {
  const product = (identifier: string, subscriptionPeriod: string, priceString: string) => ({
    identifier,
    priceString,
    price: 1,
    currencyCode: "USD",
    subscriptionPeriod,
    introPrice: null,
    defaultOption: { freePhase: null, pricingPhases: [] },
  });
  const monthly = { identifier: "$rc_monthly", product: product("votic_plus:monthly", "P1M", "$9.99") };
  const annual = { identifier: "$rc_annual", product: product("votic_plus:annual", "P1Y", "$59.99") };
  sdk.getOfferings.mockResolvedValue({ current: { availablePackages: [monthly, annual] } } as never);
  sdk.logIn.mockResolvedValue({ customerInfo: info(true), created: false });
  sdk.getAppUserID.mockResolvedValue("a");
  sdk.purchasePackage.mockResolvedValue({ customerInfo: info(true) } as never);
  const service = create_revenue_cat_service("key", "pro");
  await service.identify("a");
  expect((await service.get_plans()).map((plan) => [plan.id, plan.priceString])).toEqual([
    ["$rc_monthly", "$9.99"],
    ["$rc_annual", "$59.99"],
  ]);
  expect(await service.change_plan?.("$rc_annual", "votic_plus:monthly")).toMatchObject({
    kind: "purchased",
  });
  expect(sdk.purchasePackage).toHaveBeenLastCalledWith(annual, null, {
    oldProductIdentifier: "votic_plus",
    replacementMode: "WITH_TIME_PRORATION",
  });
  await service.change_plan?.("$rc_monthly", "votic_plus:annual");
  expect(sdk.purchasePackage).toHaveBeenLastCalledWith(monthly, null, {
    oldProductIdentifier: "votic_plus",
    replacementMode: "DEFERRED",
  });
  sdk.purchasePackage.mockRejectedValue({ userCancelled: true });
  expect(await service.change_plan?.("$rc_annual", "votic_plus:monthly")).toEqual({ kind: "cancelled" });
  expect(await service.change_plan?.("missing", "votic_plus:monthly")).toMatchObject({ kind: "failed" });
  Object.assign(Platform, { OS: "ios" });
  sdk.purchasePackage.mockResolvedValue({ customerInfo: info(true) } as never);
  await service.change_plan?.("$rc_annual", "votic_plus_monthly");
  expect(sdk.purchasePackage).toHaveBeenLastCalledWith(annual, null, null);
});

it("reads the retention discount and the regular price from the store's tagged offer", async () => {
  const { retention_offer_from } = await import("./revenueCatService");
  const phase = (formatted: string, micros: number, iso: string, mode: number, cycles: number | null) => ({
    billingPeriod: { iso8601: iso, unit: "MONTH", value: 1 },
    recurrenceMode: mode,
    billingCycleCount: cycles,
    price: { formatted, amountMicros: micros, currencyCode: "USD" },
    offerPaymentMode: null,
  });
  const regular = phase("$9.99", 9_990_000, "P1M", 1, null);
  const option = {
    id: "monthly:stay",
    tags: ["votic-retention"],
    pricingPhases: [phase("$7.99", 7_990_000, "P1M", 2, 2), regular],
    fullPricePhase: regular,
  } as unknown as Parameters<typeof retention_offer_from>[1];
  expect(retention_offer_from("votic_plus", option)).toEqual({
    id: "monthly:stay",
    productId: "votic_plus",
    offerPrice: "$7.99",
    offerPeriod: { count: 1, unit: "month" },
    offerCycles: 2,
    regularPrice: "$9.99",
    regularPeriod: { count: 1, unit: "month" },
  });
  // No discount (or a "discount" that isn't cheaper) is never shown as one.
  expect(
    retention_offer_from("votic_plus", { ...option, pricingPhases: [regular] } as unknown as typeof option),
  ).toBeNull();
});

it("offers each subscriber the discount on their own plan, never another plan's", async () => {
  sdk.logIn.mockResolvedValue({ customerInfo: info(true), created: false });
  sdk.getAppUserID.mockResolvedValue("a");
  const option = (id: string, regular: [number, string, string], offer: [number, string]) => ({
    id,
    tags: ["votic-retention"],
    fullPricePhase: {
      price: { amountMicros: regular[0], formatted: regular[1] },
      billingPeriod: { iso8601: regular[2] },
    },
    pricingPhases: [
      {
        recurrenceMode: 2,
        billingCycleCount: 1,
        price: { amountMicros: offer[0], formatted: offer[1] },
        billingPeriod: { iso8601: regular[2] },
      },
    ],
  });
  const monthly = {
    product: {
      identifier: "votic_plus:monthly",
      subscriptionOptions: [option("monthly:stay", [9990000, "$9.99", "P1M"], [7990000, "$7.99"])],
    },
  };
  const annual = {
    product: {
      identifier: "votic_plus:annual",
      subscriptionOptions: [option("annual:stay", [59990000, "$59.99", "P1Y"], [39990000, "$39.99"])],
    },
  };
  sdk.getOfferings.mockResolvedValue({ current: { availablePackages: [monthly, annual] } } as never);
  const service = create_revenue_cat_service("public-key", "pro");
  await service.identify("a");
  expect(await service.get_retention_offer?.("votic_plus:annual")).toMatchObject({
    id: "annual:stay",
    offerPrice: "$39.99",
    offerPeriod: { count: 1, unit: "year" },
    regularPrice: "$59.99",
  });
  expect(await service.get_retention_offer?.("votic_plus:monthly")).toMatchObject({ id: "monthly:stay" });
  // An annual subscriber with no annual discount set up isn't shown the monthly one.
  sdk.getOfferings.mockResolvedValue({ current: { availablePackages: [monthly] } } as never);
  expect(await service.get_retention_offer?.("votic_plus:annual")).toBeNull();
  // Access that isn't one of the listed plans (a RevenueCat promotional grant) gets the first discount, as before.
  sdk.getOfferings.mockResolvedValue({ current: { availablePackages: [monthly, annual] } } as never);
  expect(await service.get_retention_offer?.("rc_promo_premium_monthly")).toMatchObject({
    id: "monthly:stay",
  });
  sdk.getOfferings.mockResolvedValue({ current: { availablePackages: [monthly] } } as never);
  // Without a known plan, the first discount set up is offered, as before.
  expect(await service.get_retention_offer?.(null)).toMatchObject({ id: "monthly:stay" });
});

it("reads a single-payment stay-and-save offer, like $39.99 for 12 months, as one discounted year", () => {
  const offer = retention_offer_from("votic_plus:votic-plus-annual", {
    id: "votic-plus-annual:stay-annual",
    tags: ["votic-retention", "rc-ignore-offer"],
    fullPricePhase: {
      price: { amountMicros: 59990000, formatted: "$59.99" },
      billingPeriod: { iso8601: "P1Y" },
    },
    pricingPhases: [
      {
        recurrenceMode: 3,
        billingCycleCount: null,
        price: { amountMicros: 39990000, formatted: "$39.99" },
        billingPeriod: { iso8601: "P12M" },
      },
      {
        recurrenceMode: 1,
        billingCycleCount: null,
        price: { amountMicros: 59990000, formatted: "$59.99" },
        billingPeriod: { iso8601: "P1Y" },
      },
    ],
  } as never);
  expect(offer).toMatchObject({
    offerPrice: "$39.99",
    offerPeriod: { count: 1, unit: "year" },
    offerCycles: 1,
    regularPrice: "$59.99",
    regularPeriod: { count: 1, unit: "year" },
  });
});
