import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Context, useState } from "react";
import { Linking, Pressable, Text } from "react-native";
import { router } from "expo-router";
import * as api from "../../src/api/voticApi";
import { UsageLimitNotice } from "../../src/subscription/UsageLimitNotice";
import { allowance_notifier } from "../../src/subscription/allowanceNotice";
import { render_with_providers } from "../renderWithProviders";

jest.mock("expo-router", () => {
  const original = jest.requireActual<object>("../mocks/expoRouter");
  const React = jest.requireActual<typeof import("react")>("react");
  const TestFocusContext = React.createContext(true);
  return {
    ...original,
    TestFocusContext,
    useFocusEffect(effect: () => void | (() => void)) {
      const focused = React.useContext(TestFocusContext);
      React.useEffect(() => (focused ? effect() : undefined), [effect, focused]);
    },
  };
});
const { TestFocusContext } = jest.requireMock<{ TestFocusContext: Context<boolean> }>("expo-router");
const limit = { code: "AI_CREDITS_EXHAUSTED", resetsAt: "2026-11-01T00:00:00Z" };
const reading = jest.fn();
function Feature() {
  const [focused, setFocused] = useState(true);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Keep reading" onPress={reading}>
        <Text>Keep reading</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch screen"
        onPress={() => setFocused((value) => !value)}
      >
        <Text>Switch screen</Text>
      </Pressable>
      <TestFocusContext.Provider value={focused}>
        <UsageLimitNotice />
      </TestFocusContext.Provider>
    </>
  );
}
function setup() {
  jest.setSystemTime(new Date("2026-10-24T12:00:00Z"));
  return jest.spyOn(api, "subscription_options").mockResolvedValue({ current: null, upgrades: [] });
}
it("explains calmly, keeps reading usable, and opens AI Usage only after an explicit tap", async () => {
  const plans = setup();
  const store = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  reading.mockClear();
  await render_with_providers(<Feature />);
  await act(async () => allowance_notifier()(limit));
  expect(
    screen.getByText(/You've used this month's AI usage\. It renews (October 31|November 1), 2026\./),
  ).toBeTruthy();
  expect(screen.getByText("Reading, listening, and your notes keep working as usual.")).toBeTruthy();
  // No upgrade to another plan, and no raw credit counts.
  expect(screen.queryByText(/plan|Pro\b|credit/i)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Keep reading" }));
  expect(reading).toHaveBeenCalledTimes(1);
  expect(plans).not.toHaveBeenCalled();
  expect(store).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
  expect(screen.queryByText("Your subscription")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "AI Usage" }));
  expect(router.push).toHaveBeenCalledWith("/ai-usage");
  expect(router.push).not.toHaveBeenCalledWith("/subscription");
  expect(store).not.toHaveBeenCalled();
});
it("can be dismissed, and the server's provider safeguard uses the same notice", async () => {
  setup();
  await render_with_providers(<Feature />);
  await act(async () =>
    allowance_notifier()({ code: "AI_MONTHLY_ALLOWANCE", resetsAt: "2026-11-02T00:00:00Z" }),
  );
  expect(screen.getByTestId("ai-usage-notice")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Dismiss AI usage notice" }));
  expect(screen.queryByTestId("ai-usage-notice")).toBeNull();
  // The same reset is not announced again in this session.
  await act(async () =>
    allowance_notifier()({ code: "AI_MONTHLY_ALLOWANCE", resetsAt: "2026-11-02T00:00:00Z" }),
  );
  expect(screen.queryByTestId("ai-usage-notice")).toBeNull();
});
it("clears on leaving the feature and does not repeat the upsell on return", async () => {
  setup();
  await render_with_providers(<Feature />);
  await act(async () => allowance_notifier()(limit));
  expect(screen.getByTestId("ai-usage-notice")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Switch screen" }));
  expect(screen.queryByTestId("ai-usage-notice")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Switch screen" }));
  await act(async () => allowance_notifier()(limit));
  expect(screen.queryByTestId("ai-usage-notice")).toBeNull();
});
it("ignores responses from a screen that was left while its request was pending", async () => {
  setup();
  await render_with_providers(<Feature />);
  const old = allowance_notifier();
  await fireEvent.press(screen.getByRole("button", { name: "Switch screen" }));
  await act(async () => old(limit));
  await fireEvent.press(screen.getByRole("button", { name: "Switch screen" }));
  await act(async () => old(limit));
  expect(screen.queryByTestId("ai-usage-notice")).toBeNull();
  await act(async () => allowance_notifier()(limit));
  expect(screen.getByTestId("ai-usage-notice")).toBeTruthy();
});
it("removes expired reset information without reopening plans or requiring an upgrade", async () => {
  const plans = setup();
  jest.setSystemTime(new Date("2026-10-31T23:59:59Z"));
  await render_with_providers(<Feature />, { reduceMotion: true });
  await act(async () => allowance_notifier()(limit));
  expect(screen.getByTestId("ai-usage-notice")).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(1001);
  });
  expect(screen.queryByTestId("ai-usage-notice")).toBeNull();
  expect(plans).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});
