import { expect, it, jest } from "@jest/globals";
import { act } from "@testing-library/react-native";
import { ReactNode } from "react";
import TabLayout from "../../app/(tabs)/_layout";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { render_with_providers } from "../renderWithProviders";

type TabOptions = { animation?: string; transitionSpec?: { config: { duration: number } } };
const tabs: { options: TabOptions[] } = { options: [] };
jest.mock("expo-router", () => {
  const mock = jest.requireActual<Record<string, unknown>>("../mocks/expoRouter");
  function Tabs({ screenOptions }: { screenOptions: TabOptions; children?: ReactNode }) {
    tabs.options.push(screenOptions);
    return null;
  }
  Tabs.Screen = function TabsScreen() {
    return null;
  };
  return { ...mock, Tabs };
});

it("keeps the tab animation when Less motion is turned on, and makes it instant instead", async () => {
  let access: ReturnType<typeof useAccessibilityPreferences>;
  function AccessProbe() {
    access = useAccessibilityPreferences();
    return null;
  }
  await render_with_providers(
    <>
      <TabLayout />
      <AccessProbe />
    </>,
  );
  expect(tabs.options.at(-1)).toMatchObject({
    animation: "shift",
    transitionSpec: { config: { duration: 150 } },
  });
  // Switching the animation to "none" while the tabs were open left Home and Notes blank.
  await act(async () => access!.setReduceMotion(true));
  expect(tabs.options.at(-1)).toMatchObject({
    animation: "shift",
    transitionSpec: { config: { duration: 0 } },
  });
  expect(new Set(tabs.options.map((options) => options.animation))).toEqual(new Set(["shift"]));
});
