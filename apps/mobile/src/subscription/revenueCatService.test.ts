import { beforeEach, expect, it, vi } from "vitest";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { create_revenue_cat_service } from "./revenueCatService";

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
  sdk.isAnonymous.mockResolvedValue(false);
  sdk.logOut.mockResolvedValue(info(false));
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
  service.onChange(changed);
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
