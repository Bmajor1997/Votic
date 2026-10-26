import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { AppState, AppStateStatus, StyleSheet, ViewStyle } from "react-native";
import AiUsageScreen from "../../app/ai-usage";
import * as api from "../../src/api/voticApi";
import { notify_ai_usage_changed } from "../../src/subscription/aiUsage";
import type { AiUsage } from "../../src/subscription/aiUsage";
import { entitlement_of, fakeSubscriptions } from "../mocks/subscriptionService";
import { render_with_providers } from "../renderWithProviders";

// Mocked server answers for the screen only. The real percentage and period math is tested on the server.
const usage = (overrides: Partial<AiUsage> = {}, percentRemaining = 99): AiUsage => ({
  status: "active",
  plan: { name: "Votic Plus" },
  monthly: {
    percentRemaining,
    periodEnd: "2026-11-03T10:00:00.000Z",
    resetsAt: "2026-11-03T10:00:00.000Z",
    billingPeriodVerified: true,
  },
  purchased: { remaining: 0 },
  purchaseProducts: [],
  ...overrides,
});
const product = { productId: "votic_ai_100", title: "More AI usage", priceString: "$2.99" };

it("shows the server's percentage once, above an accessible progress bar, with the renewal date", async () => {
  jest.spyOn(api, "ai_usage").mockResolvedValue(usage());
  await render_with_providers(<AiUsageScreen />);
  expect(screen.getByRole("header", { name: "AI Usage" })).toBeTruthy();
  expect(screen.getByText("MONTHLY AI ALLOWANCE")).toBeTruthy();
  expect(screen.getAllByText(/99% remaining/)).toHaveLength(1);
  expect(screen.queryByText(/% used|% left/)).toBeNull();
  expect(screen.queryByText(/credit|1,000|990/i)).toBeNull();
  const bar = screen.getByRole("progressbar");
  expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 99, text: "99% remaining" });
  expect(screen.getByText(/^Renews November 3, 2026$/)).toBeTruthy();
});

it.each([
  [100, "100% remaining"],
  [37, "37% remaining"],
  [0, "0% remaining"],
])("renders %i%% as the bar's settled width with Reduce Motion", async (percent, text) => {
  jest.spyOn(api, "ai_usage").mockResolvedValue(usage({}, percent));
  await render_with_providers(<AiUsageScreen />, { reduceMotion: true });
  expect(screen.getByText(text)).toBeTruthy();
  const fill = screen.getByTestId("ai-usage-bar").children[0] as unknown as { props: { style: unknown } };
  expect(StyleSheet.flatten(fill.props.style as ViewStyle).width).toBe(`${percent}%`);
});

it("shows a loading state, then an error with Try again, and never a made-up percentage when offline", async () => {
  let fail!: (error: Error) => void;
  const read = jest
    .spyOn(api, "ai_usage")
    .mockImplementationOnce(() => new Promise((_resolve, reject) => (fail = reject)))
    .mockResolvedValueOnce(usage());
  await render_with_providers(<AiUsageScreen />);
  expect(screen.getByLabelText("Loading AI usage")).toBeTruthy();
  await act(async () => fail(new Error("Votic could not connect. Check your connection and try again.")));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByText(/could not connect/)).toBeTruthy();
  expect(screen.queryByText(/% remaining/)).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("99% remaining")).toBeTruthy();
  expect(read).toHaveBeenCalledTimes(2);
});

it("explains an ended subscription and a server without usage tracking, without a percentage", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("expired") });
  const read = jest
    .spyOn(api, "ai_usage")
    .mockResolvedValue(usage({ status: "not-subscribed", plan: null, monthly: null }));
  const rendered = await render_with_providers(<AiUsageScreen />);
  expect(screen.getByText(/Your Votic Plus subscription has ended/)).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
  await rendered.unmount();
  read.mockResolvedValue(usage({ status: "not-configured", plan: null, monthly: null, purchased: null }));
  await render_with_providers(<AiUsageScreen />);
  expect(screen.getByText(/aren't available from this Votic server/)).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
});

it("refreshes after an AI request finishes and when Votic returns to the foreground, without polling", async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    listeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => {} } as never;
  });
  const read = jest
    .spyOn(api, "ai_usage")
    .mockResolvedValueOnce(usage({}, 99))
    .mockResolvedValueOnce(usage({}, 97))
    .mockResolvedValueOnce(usage({}, 95));
  await render_with_providers(<AiUsageScreen />);
  expect(screen.getByText("99% remaining")).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(10 * 60_000));
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => notify_ai_usage_changed());
  expect(screen.getByText("97% remaining")).toBeTruthy();
  await act(async () => listeners.forEach((listener) => listener("active")));
  expect(screen.getByText("95% remaining")).toBeTruthy();
});

it("shows additional usage separately without counts, and offers only configured store products when used up", async () => {
  fakeSubscriptions.creditProducts = [product, { ...product, productId: "not-credited" }];
  const read = jest
    .spyOn(api, "ai_usage")
    .mockResolvedValue(usage({ purchaseProducts: ["votic_ai_100"] }, 0));
  await render_with_providers(<AiUsageScreen />);
  expect(screen.getByRole("header", { name: "Need more?" })).toBeTruthy();
  expect(fakeSubscriptions.calls).toContain("getCreditProducts:votic_ai_100");
  expect(screen.queryByRole("button", { name: /not-credited/ })).toBeNull();
  const buy = screen.getByRole("button", { name: "More AI usage · $2.99" });
  expect(buy.props.accessibilityHint).toMatch(/doesn't change your subscription/);
  read.mockResolvedValue(usage({ purchaseProducts: ["votic_ai_100"], purchased: { remaining: 100 } }, 0));
  await fireEvent.press(buy);
  expect(fakeSubscriptions.calls).toContain("purchaseCredits:votic_ai_100");
  expect(screen.getByText(/appears here once the store confirms the purchase/)).toBeTruthy();
  expect(screen.getByRole("header", { name: "Additional AI usage" })).toBeTruthy();
  expect(screen.queryByText(/100/)).toBeNull();
});

it("never offers a purchase that isn't configured, and says so only when usage has run out", async () => {
  const read = jest.spyOn(api, "ai_usage").mockResolvedValue(usage({}, 40));
  const rendered = await render_with_providers(<AiUsageScreen />);
  expect(screen.queryByRole("header", { name: "Need more?" })).toBeNull();
  await rendered.unmount();
  read.mockResolvedValue(usage({}, 0));
  await render_with_providers(<AiUsageScreen />);
  expect(screen.getByText(/isn't available to buy right now/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /·/ })).toBeNull();
});

it("explains that buying needs a store build when this build can't make purchases", async () => {
  fakeSubscriptions.reset({ unavailableReason: "expo-go" });
  jest.spyOn(api, "ai_usage").mockResolvedValue(usage({ purchaseProducts: ["votic_ai_100"] }, 0));
  await render_with_providers(<AiUsageScreen />);
  expect(screen.getByText(/needs the store version of Votic/)).toBeTruthy();
  expect(fakeSubscriptions.calls.some((call) => call.startsWith("getCreditProducts"))).toBe(false);
});

it("keeps pending and cancelled purchases honest", async () => {
  fakeSubscriptions.creditProducts = [product];
  jest.spyOn(api, "ai_usage").mockResolvedValue(usage({ purchaseProducts: ["votic_ai_100"] }, 0));
  await render_with_providers(<AiUsageScreen />);
  fakeSubscriptions.nextCreditPurchase = { kind: "cancelled" };
  await fireEvent.press(screen.getByRole("button", { name: "More AI usage · $2.99" }));
  expect(screen.queryByText(/appears here/)).toBeNull();
  fakeSubscriptions.nextCreditPurchase = { kind: "pending" };
  await fireEvent.press(screen.getByRole("button", { name: "More AI usage · $2.99" }));
  expect(screen.getByText(/waiting for approval/)).toBeTruthy();
  fakeSubscriptions.nextCreditPurchase = { kind: "failed", message: "The store couldn't confirm it." };
  await fireEvent.press(screen.getByRole("button", { name: "More AI usage · $2.99" }));
  expect(screen.getByText("The store couldn't confirm it.")).toBeTruthy();
});
