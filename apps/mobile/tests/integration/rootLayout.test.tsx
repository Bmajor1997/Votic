import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import RootLayout from "../../app/_layout";
import { ONBOARDING_KEY } from "../../src/onboarding/OnboardingProvider";
import { fakeAuth } from "../mocks/authBackend";
import { stackScreens } from "../mocks/expoRouter";
import { seedStorage } from "../renderWithProviders";

async function renderLayout() {
  await render(<RootLayout />);
  await act(async () => {});
  // Screens register again on every render, so compare the distinct names.
  return [...new Set(stackScreens.map((screen) => screen.name))];
}

describe("root navigation", () => {
  it("opens the Reader over the current screen without a competing stack animation", async () => {
    await seedStorage({});
    await renderLayout();
    const reader = stackScreens.find((screen) => screen.name === "reader");
    // transparentModal keeps the source screen mounted so the Reader can grow out of the tapped card.
    expect(reader?.options).toMatchObject({
      animation: "none",
      presentation: "transparentModal",
      contentStyle: { backgroundColor: "transparent" },
    });
    expect(stackScreens.map((screen) => screen.name)).toEqual(
      expect.arrayContaining(["(tabs)", "reader", "assistant", "review", "recap"]),
    );
  });

  it("shows only Welcome and email sign-in to someone who is signed out", async () => {
    fakeAuth.reset(null);
    await seedStorage({});
    expect(await renderLayout()).toEqual(["welcome", "sign-in"]);
  });

  it("protects Settings details and honors Reduce Motion for their navigation", async () => {
    await seedStorage({ reduceMotion: true });
    await renderLayout();
    expect(
      stackScreens.filter((screen) => screen.name === "settings/[category]").at(-1)?.options,
    ).toMatchObject({
      animation: "none",
    });
  });

  it("sends a new account to personalization before Home", async () => {
    await seedStorage({ onboarding: { personalized: false } });
    expect(await renderLayout()).toEqual(["personalize"]);
  });

  it("treats a first launch as new even though other providers save their defaults right away", async () => {
    await renderLayout();
    expect(JSON.parse((await AsyncStorage.getItem(ONBOARDING_KEY)) || "{}")).toMatchObject({
      personalized: false,
      tipsSeen: [],
    });
    expect([...new Set(stackScreens.map((screen) => screen.name))]).toEqual(["personalize"]);
  });

  it("lets people who used an earlier version go straight to Home after signing in", async () => {
    await AsyncStorage.setItem("votic.mobile.first-run-tour.v1", "complete");
    expect(await renderLayout()).toEqual(expect.arrayContaining(["(tabs)", "reader"]));
    expect(JSON.parse((await AsyncStorage.getItem(ONBOARDING_KEY)) || "{}")).toMatchObject({
      personalized: true,
      checklistDismissed: true,
    });
  });
});
