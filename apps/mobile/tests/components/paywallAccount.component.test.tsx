import { it, expect, jest } from "@jest/globals";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo, Dimensions, StyleSheet, ViewStyle } from "react-native";
import Paywall from "../../app/paywall";
import { PLUS_BENEFITS } from "../../src/subscription/PaywallContent";
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

it("shows all six Votic Plus benefits and markets AI usage without credit counts", async () => {
  expect(PLUS_BENEFITS).toHaveLength(6);
  for (const feature of PLUS_BENEFITS) expect(feature.detail.length).toBeLessThanOrEqual(80);
  await render_with_providers(<Paywall />);
  expect(screen.getByRole("header", { name: "Make more of every document." })).toBeTruthy();
  expect(screen.getByText("Your AI-powered reading companion.")).toBeTruthy();
  for (const title of [
    "Read and listen to your documents",
    "Ask AI about your documents",
    "AI-powered summaries",
    "Save notes and bookmarks",
    "Import almost anything",
    "Generous monthly AI usage",
  ])
    expect(screen.getByText(title)).toBeTruthy();
  expect(screen.queryByText(/credit/i)).toBeNull();
  expect(screen.queryByText(/1,000|1000/)).toBeNull();
  expect(screen.queryByText(/Pro\b/)).toBeNull();
});

it("shows the store's localized price and billing period, never a hardcoded one", async () => {
  fakeSubscriptions.reset({
    defaultEntitlement: entitlement_of("none"),
    plans: [{ ...TWO_WEEK_TRIAL_PLAN, trial: null, priceString: "€11,49" }],
  });
  await render_with_providers(<Paywall />);
  expect(screen.getByLabelText(/^Votic Plus, €11,49\/month\. Auto-renews\./)).toBeTruthy();
  expect(screen.getByText(/Billed every month\. Cancel anytime in (Google Play|App Store)\./)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Subscribe for €11,49/month" })).toBeTruthy();
  expect(screen.queryByText(/\$9\.99/)).toBeNull();
});

const MONTH = {
  ...TWO_WEEK_TRIAL_PLAN,
  trial: null,
  productId: "plus:monthly",
  priceAmount: 9.99,
  currencyCode: "USD",
};
const YEAR = {
  ...MONTH,
  id: "$rc_annual",
  productId: "plus:annual",
  priceString: "$79.99",
  priceAmount: 79.99,
  billingPeriod: { count: 1, unit: "year" as const },
};

it("offers monthly and annual billing side by side, starting on monthly, and hides other packages", async () => {
  const week = {
    ...MONTH,
    id: "week",
    priceString: "$4.99",
    billingPeriod: { count: 1, unit: "week" as const },
  };
  fakeSubscriptions.reset({ plans: [YEAR, week, MONTH], defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />);
  const monthly = screen.getByRole("radio", { name: /^Monthly, \$9\.99 per month$/ });
  const annual = screen.getByRole("radio", {
    name: "Yearly, $79.99 per year, equivalent to $6.67 a month. Save 33% compared with 12 monthly payments at regular prices",
  });
  expect(monthly.props.accessibilityState.checked).toBe(true);
  expect(annual.props.accessibilityState.checked).toBe(false);
  expect(screen.queryByText(/\$4\.99/)).toBeNull();
  // The annual card shows the full yearly charge, its savings and the monthly equivalent from store prices.
  expect(within(annual).getByText("Save 33%")).toBeTruthy();
  expect(within(annual).getByText("About $6.67/month")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Subscribe for $9.99/month" })).toBeTruthy();
});

it("shows the full annual charge once annual is chosen, and buys exactly that plan", async () => {
  fakeSubscriptions.reset({ plans: [MONTH, YEAR], defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall now={() => new Date(2026, 9, 19, 12)} />);
  await fireEvent.press(screen.getByRole("radio", { name: /^Yearly,/ }));
  expect(screen.getByRole("radio", { name: /^Yearly,/ }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByLabelText(/^Votic Plus, \$79\.99\/year\. Auto-renews\./)).toBeTruthy();
  expect(screen.getByText(/^Equivalent to \$6\.67\/month, billed yearly\. Save 33% compared/)).toBeTruthy();
  expect(screen.getByText(/renews automatically at \$79\.99 per year/)).toBeTruthy();
  expect(screen.getByText("Same Votic Plus features on either plan.")).toBeTruthy();
  for (const title of ["Ask AI about your documents", "Generous monthly AI usage"])
    expect(screen.getByText(title)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Subscribe for $79.99/year" }));
  expect(fakeSubscriptions.calls).toContain("purchase:$rc_annual");
  expect(fakeSubscriptions.calls).not.toContain("purchase:$rc_monthly");
});

it("calculates savings from the store's actual prices, and shows none it can't verify", async () => {
  fakeSubscriptions.reset({
    plans: [MONTH, { ...YEAR, priceString: "$89.99", priceAmount: 89.99 }],
    defaultEntitlement: entitlement_of("none"),
  });
  const rendered = await render_with_providers(<Paywall />);
  expect(screen.getByText("Save 24%")).toBeTruthy();
  expect(screen.getByText("About $7.50/month")).toBeTruthy();
  await rendered.unmount();
  fakeSubscriptions.reset({
    plans: [MONTH, { ...YEAR, priceString: "€79,99", currencyCode: "EUR" }],
    defaultEntitlement: entitlement_of("none"),
  });
  await render_with_providers(<Paywall />);
  expect(screen.getAllByText(/€79,99/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Save \d+%/)).toBeNull();
  expect(screen.queryByText(/About .*\/month/)).toBeNull();
});

it("switches billing options instantly with Reduce Motion, and restores purchases from either option", async () => {
  fakeSubscriptions.reset({ plans: [MONTH, YEAR], defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />, { reduceMotion: true });
  await fireEvent.press(screen.getByRole("radio", { name: /^Yearly,/ }));
  expect(visible_opacity(screen.getByLabelText(/^Votic Plus, \$79\.99\/year/) as never)).toBe(1);
  fakeSubscriptions.restoreResult = entitlement_of("active");
  await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
  expect(screen.getByText("Your Votic Plus subscription is restored.")).toBeTruthy();
});

it("settles the offer briefly when switching billing options without Reduce Motion", async () => {
  fakeSubscriptions.reset({ plans: [MONTH, YEAR], defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />);
  await fireEvent.press(screen.getByRole("radio", { name: /^Yearly,/ }));
  const offer = () => screen.getByLabelText(/^Votic Plus, \$79\.99\/year/) as never;
  expect(visible_opacity(offer())).toBeLessThan(1);
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(visible_opacity(offer())).toBe(1);
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

it("shows plans before the preview and keeps required subscription and renewal terms visible", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />);
  // No numbered sections, no jump button and no extra "make it yours" block.
  expect(screen.queryByText(/^0[1-4] \//, { includeHiddenElements: true })).toBeNull();
  expect(screen.queryByRole("button", { name: "Jump to subscription plans" })).toBeNull();
  expect(
    screen.getByText("A subscription is required for your documents. Try the sample preview for free."),
  ).toBeTruthy();
  expect(screen.getByText("Get answers grounded in what you're reading, typed or spoken.")).toBeTruthy();
  expect(screen.getByText(/Auto-renews. Cancel anytime in (Google Play|App Store)/)).toBeTruthy();
  expect(screen.queryByText("Start with one document.")).toBeNull();
  const headers = screen.getAllByRole("header");
  expect(headers.indexOf(screen.getByRole("header", { name: "Included with Votic Plus" }))).toBeLessThan(
    headers.indexOf(screen.getByRole("header", { name: "Votic Plus" })),
  );
  expect(screen.getByText("Includes a 2-week free trial")).toBeTruthy();
  // The full "then $9.99/month" sentence appears once, above the button.
  expect(screen.getAllByText(/2 weeks free, then \$9\.99\/month/)).toHaveLength(1);
  // Questions stay closed until asked for, and still explain cancelling.
  expect(screen.queryByText("How do I cancel?")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Subscription questions" }));
  expect(screen.getByText("How do I cancel?")).toBeTruthy();
  expect(screen.getByText(/unused usage doesn't carry over/)).toBeTruthy();
});

it("links subscription terms and privacy policy when configured, beside restore and cancel", async () => {
  fakeSubscriptions.reset({
    defaultEntitlement: entitlement_of("none"),
    legal: { termsUrl: "https://votic.example/terms", privacyUrl: "https://votic.example/privacy" },
  });
  await render_with_providers(<Paywall />);
  for (const name of ["Terms", "Privacy", "Restore Purchases", /^Manage or cancel in /])
    expect(screen.getByRole("button", { name })).toBeTruthy();
});

it("welcomes a new subscriber with a short, announced celebration that also works with Less motion", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
  try {
    await render_with_providers(<Paywall />, { reduceMotion: true });
    expect(screen.queryByRole("header", { name: "You're in." })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(screen.getByRole("header", { name: "You're in." })).toBeTruthy();
    expect(screen.getByText("Welcome to Votic Plus. Your library is ready.")).toBeTruthy();
    expect(announce).toHaveBeenCalledWith("You're in. Welcome to Votic Plus. Your library is ready.");
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

it("keeps a store-verified trial for a lapsed subscriber instead of guessing their trial history", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("expired") });
  await render_with_providers(<Paywall />);
  expect(screen.getByRole("button", { name: "Start free trial" })).toBeTruthy();
  expect(screen.getByText("Includes a 2-week free trial")).toBeTruthy();
});

it("can restore even when offerings fail, and distinguishes no purchase from an unreachable store", async () => {
  fakeSubscriptions.reset({ plans: new Error("offline"), defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />);
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
  expect(screen.getByText(/No active Votic Plus subscription was found/)).toBeTruthy();
  fakeSubscriptions.restoreResult = entitlement_of("unknown");
  await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
  expect(screen.getByText(/couldn't reach the store. Check your connection/)).toBeTruthy();
  fakeSubscriptions.restoreResult = entitlement_of("active");
  await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
  expect(screen.getByText("Your Votic Plus subscription is restored.")).toBeTruthy();
});

it.each([
  { width: 320, height: 568, fontScale: 1 },
  { width: 390, height: 844, fontScale: 1.6 },
])(
  "keeps one checkout in the scrolling flow at $width × $height with font scale $fontScale",
  async (dimensions) => {
    const original = Dimensions.get("window");
    Dimensions.set({ window: { ...original, ...dimensions } });
    try {
      fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
      await render_with_providers(<Paywall />, { reduceMotion: true });
      const scroll = screen.getByTestId("paywall-content");
      expect(within(scroll).getByRole("button", { name: "Start free trial" })).toBeTruthy();
      expect(within(scroll).getByRole("button", { name: "Restore Purchases" })).toBeTruthy();
      expect(screen.getAllByRole("button", { name: "Start free trial" })).toHaveLength(1);
    } finally {
      await act(async () => {
        Dimensions.set({ window: original });
      });
    }
  },
);

/** The nearest animated wrapper's opacity for an element (1 when nothing fades it). */
function visible_opacity(element: { parent: unknown; props: { style?: unknown } }) {
  let node: typeof element | null = element;
  while (node) {
    const opacity = StyleSheet.flatten(node.props.style as ViewStyle)?.opacity;
    if (typeof opacity === "number") return opacity;
    node = node.parent as typeof element | null;
  }
  return 1;
}

it("shows the whole paywall at once with Reduce Motion", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />, { reduceMotion: true });
  expect(visible_opacity(screen.getByRole("header", { name: "Make more of every document." }) as never)).toBe(
    1,
  );
  expect(visible_opacity(screen.getByText("Generous monthly AI usage") as never)).toBe(1);
});

it("settles its entrance in under a second and then stays still", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<Paywall />);
  const headline = () => screen.getByRole("header", { name: "Make more of every document." }) as never;
  expect(visible_opacity(headline())).toBeLessThan(1);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(visible_opacity(headline())).toBe(1);
  expect(visible_opacity(screen.getByText("Generous monthly AI usage") as never)).toBe(1);
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(visible_opacity(headline())).toBe(1);
});
