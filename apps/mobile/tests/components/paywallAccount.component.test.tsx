import { it, expect, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import Paywall, { PREMIUM_FEATURES } from "../../app/paywall";
import AccountManagement from "../../app/account";
import { fakeAuth } from "../mocks/authBackend";
import { entitlement_of, fakeSubscriptions, TWO_WEEK_TRIAL_PLAN } from "../mocks/subscriptionService";
import { router } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";
import { load_account_preferences } from "../../src/onboarding/accountPreferences";

it("an expired subscriber can reach account management from the paywall and delete with both confirmations", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("expired") });
  const rendered = await render_with_providers(<Paywall />);
  await fireEvent.press(screen.getByRole("button", { name: "Manage account" }));
  expect(router.push).toHaveBeenCalledWith("/account");
  await rendered.unmount();
  await render_with_providers(<AccountManagement />);
  expect(await load_account_preferences("test-user")).not.toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  expect(fakeAuth.calls).not.toContain("deleteAccount");
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(fakeAuth.calls).not.toContain("deleteAccount");
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  expect(fakeAuth.calls).toContain("deleteAccount");
  expect(fakeAuth.user).toBeNull();
  expect(await load_account_preferences("test-user")).toBeNull();
});

it("keeps three benefits prominent and reveals the complete set on request", async () => {
  expect(PREMIUM_FEATURES).toHaveLength(6);
  for (const feature of PREMIUM_FEATURES) expect(feature.detail.length).toBeLessThanOrEqual(80);
  await render_with_providers(<Paywall />);
  await fireEvent.press(screen.getByRole("button", { name: "See all included benefits" }));
  for (const title of [
    "Read anything",
    "Listen as it's read aloud",
    "Ask Votic",
    "Pick up where you left off",
  ])
    expect(screen.getByText(title)).toBeTruthy();
});

it("switches between real weekly, monthly and annual offers and purchases only the selected one", async () => {
  const month = { ...TWO_WEEK_TRIAL_PLAN, priceAmount: 9.99, currencyCode: "USD" };
  const year = {
    ...month,
    id: "year",
    priceString: "$79.99",
    priceAmount: 79.99,
    billingPeriod: { count: 1, unit: "year" as const },
  };
  const week = {
    ...month,
    id: "week",
    priceString: "$4.99",
    priceAmount: 4.99,
    trial: null,
    billingPeriod: { count: 1, unit: "week" as const },
  };
  fakeSubscriptions.reset({ plans: [month, year, week], defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall now={() => new Date(2026, 9, 19, 12)} />);
  expect(screen.getByText("Save 33% compared with 12 monthly payments")).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: /^Yearly,/ }));
  expect(screen.getByText(/Your subscription starts at \$79.99\/year/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: /^Weekly,/ }));
  expect(screen.queryByRole("header", { name: /Try Votic Premium free/ })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Subscribe for $4.99/week" }));
  expect(fakeSubscriptions.calls).toContain("purchase:week");
  expect(fakeSubscriptions.calls).not.toContain("purchase:year");
});

it("says plainly when the store fails unexpectedly, without showing the technical error", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />);
  fakeSubscriptions.throwNext = "purchase";
  await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
  expect(screen.getByText(/couldn't confirm your purchase.*Restore Purchases/)).toBeTruthy();
  expect(screen.queryByText(/internal detail/)).toBeNull();
  // The buttons work again afterwards.
  fakeSubscriptions.throwNext = "restore";
  await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
  expect(screen.getByText(/couldn't reach the store.*try Restore Purchases again/)).toBeTruthy();
  expect(screen.queryByText(/internal detail/)).toBeNull();
  expect(fakeSubscriptions.calls.filter((call) => call === "restore")).toHaveLength(1);
});

it("moves screen-reader focus to the plans when jumping to them", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(() => {});
  // The test renderer has no native views, so stand in for the heading's native handle.
  const find = jest.fn((_target: unknown) => 42);
  // react-native exposes its exports as getters on the real module object, so that getter is replaced.
  const reactNative = jest.requireActual<object>("react-native");
  const original = Object.getOwnPropertyDescriptor(reactNative, "findNodeHandle")!;
  Object.defineProperty(reactNative, "findNodeHandle", { configurable: true, get: () => find });
  try {
    await render_with_providers(<Paywall />);
    await fireEvent.press(screen.getByRole("button", { name: "Jump to subscription plans" }));
    expect(focus).toHaveBeenCalledWith(42);
    expect(find).toHaveBeenCalledTimes(1);
  } finally {
    focus.mockRestore();
    Object.defineProperty(reactNative, "findNodeHandle", original);
  }
});

it("hides the numbered step markers from screen readers and doesn't repeat the price on plan cards", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />);
  for (const marker of [
    "01 / WHAT OPENS UP",
    "02 / FEEL THE DIFFERENCE",
    "03 / YOUR MEMBERSHIP",
    "04 / MAKE IT YOURS",
  ]) {
    expect(screen.queryByText(marker)).toBeNull();
    expect(screen.getByText(marker, { includeHiddenElements: true })).toBeTruthy();
  }
  expect(screen.getByRole("header", { name: "Choose how you make room." })).toBeTruthy();
  expect(screen.getByText("Includes a 2-week free trial")).toBeTruthy();
  // The full "then $9.99/month" sentence appears once, above the button.
  expect(screen.getAllByText(/2 weeks free, then \$9\.99\/month/)).toHaveLength(1);
});
