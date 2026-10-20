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

it("keeps the offer short: headline, preview, three benefits, plans, then the fine print", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />);
  // No numbered sections, no jump button and no extra "make it yours" block.
  expect(screen.queryByText(/^0[1-4] \//, { includeHiddenElements: true })).toBeNull();
  expect(screen.queryByRole("button", { name: "Jump to subscription plans" })).toBeNull();
  expect(screen.queryByText("Start with one document.")).toBeNull();
  expect(screen.getByRole("header", { name: "Choose your plan" })).toBeTruthy();
  expect(screen.getByText("Includes a 2-week free trial")).toBeTruthy();
  // The full "then $9.99/month" sentence appears once, above the button.
  expect(screen.getAllByText(/2 weeks free, then \$9\.99\/month/)).toHaveLength(1);
  // Questions stay closed until asked for, and still explain cancelling.
  expect(screen.queryByText("How do I cancel?")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Subscription questions" }));
  expect(screen.getByText("How do I cancel?")).toBeTruthy();
});

it("welcomes a new subscriber with a short, announced celebration that also works with Less motion", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
  try {
    await render_with_providers(<Paywall />, { reduceMotion: true });
    expect(screen.queryByRole("header", { name: "You're in." })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(screen.getByRole("header", { name: "You're in." })).toBeTruthy();
    expect(screen.getByText("Welcome to Votic Premium. Your library is ready.")).toBeTruthy();
    expect(announce).toHaveBeenCalledWith("You're in. Welcome to Votic Premium. Your library is ready.");
  } finally {
    announce.mockRestore();
  }
});

it("never celebrates a purchase the store didn't confirm", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />);
  for (const outcome of [
    { kind: "cancelled" as const },
    { kind: "pending" as const },
    { kind: "failed" as const, message: "Your purchase couldn't be completed." },
    { kind: "purchased" as const, entitlement: entitlement_of("expired") },
  ]) {
    fakeSubscriptions.nextPurchase = outcome;
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(screen.queryByRole("header", { name: "You're in." })).toBeNull();
  }
});
