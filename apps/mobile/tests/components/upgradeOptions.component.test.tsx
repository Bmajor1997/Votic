import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { AppState, AppStateStatus, Linking } from "react-native";
import * as api from "../../src/api/voticApi";
import { UpgradeOptions } from "../../src/subscription/UpgradeOptions";
import { UsageLimitNotice } from "../../src/subscription/UsageLimitNotice";
import { allowance_notifier } from "../../src/subscription/allowanceNotice";
import { fakeSubscriptions } from "../mocks/subscriptionService";
import { fakeAuth } from "../mocks/authBackend";
import { render_with_providers } from "../renderWithProviders";

const options: api.SubscriptionOptions = {
  current: { productId: "basic", name: "Basic", store: "app_store" },
  upgrades: [{ productId: "plus", name: "Plus", capacityMultiplier: 2 }],
};
function setup() {
  jest.setSystemTime(new Date("2026-10-24T12:00:00Z"));
  jest.spyOn(api, "subscription_options").mockResolvedValue(options);
  fakeSubscriptions.plans = [
    {
      id: "pkg",
      productId: "plus",
      priceString: "$14.99",
      billingPeriod: { count: 1, unit: "month" },
      trial: null,
    },
  ];
}
it("shows a verified upgrade with localized monthly price and delegates confirmation to the store", async () => {
  setup();
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await render_with_providers(<UpgradeOptions />);
  await waitFor(() => expect(screen.getByText("$14.99/month")).toBeTruthy());
  expect(screen.getByText(/2× your current/)).toBeTruthy();
  expect(screen.queryByText(/free trial/i)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Review upgrade to Plus" }));
  expect(open).toHaveBeenCalledTimes(1);
  expect(fakeSubscriptions.calls.some((call) => call.startsWith("purchase:"))).toBe(false);
});
it("keeps the current subscription when offerings are missing or loading fails", async () => {
  setup();
  fakeSubscriptions.plans = [];
  const view = await render_with_providers(<UpgradeOptions />);
  await waitFor(() => expect(screen.getByText(/No higher-capacity monthly plan/)).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Review upgrade to Plus" })).toBeNull();
  await view.unmount();
  jest.spyOn(api, "subscription_options").mockRejectedValue(new Error("private detail"));
  await render_with_providers(<UpgradeOptions />);
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.queryByText("private detail")).toBeNull();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});
it("recovers from a store-open failure without buying or changing entitlements", async () => {
  setup();
  jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("native detail"));
  await render_with_providers(<UpgradeOptions />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Review upgrade to Plus" })).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Review upgrade to Plus" }));
  expect(screen.getByText("The store could not open. Please try again.")).toBeTruthy();
});
it("dismisses personal monthly notices once per period and ignores all other failures", async () => {
  setup();
  await render_with_providers(<UsageLimitNotice />);
  const request = allowance_notifier();
  await act(async () => request({ code: "SERVICE_LIMIT", resetsAt: "2026-11-01T00:00:00Z" }));
  expect(screen.queryByTestId("ai-usage-notice")).toBeNull();
  const result = { code: "AI_MONTHLY_ALLOWANCE", resetsAt: "2026-11-01T00:00:00Z" };
  await act(async () => request(result));
  expect(screen.getByTestId("ai-usage-notice")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Dismiss AI usage notice" }));
  await act(async () => request(result));
  expect(screen.queryByTestId("ai-usage-notice")).toBeNull();
  await act(async () => request({ ...result, resetsAt: "2026-12-01T00:00:00Z" }));
  expect(screen.getByTestId("ai-usage-notice")).toBeTruthy();
});
it("does not show another account a notice from an old request", async () => {
  setup();
  await render_with_providers(<UsageLimitNotice />);
  const oldRequest = allowance_notifier();
  await act(async () => {
    fakeAuth.setUser({ uid: "other-user", email: "other@example.test", displayName: null });
  });
  await act(async () => oldRequest({ code: "AI_MONTHLY_ALLOWANCE", resetsAt: "2026-11-01T00:00:00Z" }));
  expect(screen.queryByTestId("ai-usage-notice")).toBeNull();
});

it("resets notice suppression for a new sign-in and respects Less motion", async () => {
  setup();
  await render_with_providers(<UsageLimitNotice />, { reduceMotion: true });
  const result = { code: "AI_MONTHLY_ALLOWANCE", resetsAt: "2026-11-01T00:00:00Z" };
  await act(async () => allowance_notifier()(result));
  await fireEvent.press(screen.getByRole("button", { name: "Dismiss AI usage notice" }));
  const user = fakeAuth.user;
  await act(async () => fakeAuth.setUser(null));
  await act(async () => fakeAuth.setUser(user));
  await act(async () => allowance_notifier()(result));
  expect(screen.getByTestId("ai-usage-notice")).toBeTruthy();
});
it("drops late offer loading when the account changes", async () => {
  setup();
  let resolve: (value: api.SubscriptionOptions) => void = () => {};
  jest
    .spyOn(api, "subscription_options")
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue({ current: null, upgrades: [] });
  await render_with_providers(<UpgradeOptions />);
  await act(async () => fakeAuth.setUser({ uid: "other", email: null, displayName: null }));
  await act(async () => resolve(options));
  expect(screen.queryByRole("button", { name: "Review upgrade to Plus" })).toBeNull();
});

it("refreshes verified options after returning from store without assuming a purchase happened", async () => {
  setup();
  const listeners = new Set<(state: AppStateStatus) => void>();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  });
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  const read = jest.spyOn(api, "subscription_options");
  await render_with_providers(<UpgradeOptions />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Review upgrade to Plus" })).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Review upgrade to Plus" }));
  read.mockResolvedValue({ current: { ...options.current!, name: "Plus", productId: "plus" }, upgrades: [] });
  await act(async () => {
    for (const listener of [...listeners]) listener("active");
  });
  await waitFor(() => expect(screen.getByText("Current plan: Plus")).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Review upgrade to Plus" })).toBeNull();
  expect(fakeSubscriptions.calls.some((call) => call.startsWith("purchase:"))).toBe(false);
});
