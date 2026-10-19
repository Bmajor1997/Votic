import { it, expect } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
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
