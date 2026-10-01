import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import RootLayout from "../../app/_layout";
import { ONBOARDING_KEY } from "../../src/onboarding/OnboardingProvider";
import { loadAccountSetup } from "../../src/onboarding/onboardingStorage";
import { fakeAuth } from "../mocks/authBackend";
import { stackScreens } from "../mocks/expoRouter";
import { entitlementOf, fakeSubscriptions } from "../mocks/subscriptionService";
import { seedStorage } from "../renderWithProviders";

/** The distinct screens the layout declares right now (screens register again on every render). */
function currentScreens() {
  return [...new Set(stackScreens.map((screen) => screen.name))];
}
async function renderLayout() {
  await render(<RootLayout />);
  await act(async () => {});
  return currentScreens();
}
async function afterChange(change: () => void | Promise<void>) {
  stackScreens.length = 0;
  await act(async () => {
    await change();
  });
  await act(async () => {});
  return currentScreens();
}
const APP = ["(tabs)", "reader", "assistant", "review", "recap", "statistics"];

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
    expect(currentScreens()).toEqual(APP);
  });

  it("shows only Welcome and the account screens to someone who is signed out", async () => {
    fakeAuth.reset(null);
    await seedStorage({});
    expect(await renderLayout()).toEqual(["welcome", "create-account", "sign-in", "forgot-password"]);
  });

  it("sends a newly created account to personalization", async () => {
    fakeAuth.reset(null);
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("none") });
    await seedStorage({});
    expect(await renderLayout()).toEqual(["welcome", "create-account", "sign-in", "forgot-password"]);
    expect(
      await afterChange(() =>
        fakeAuth.setUser({ uid: "new", email: "new@example.com", displayName: null, isNewAccount: true }),
      ),
    ).toEqual(["personalize"]);
    const setup = await loadAccountSetup("new");
    expect(setup?.personalizationCompletedAt).toBeNull();
  });

  it("keeps a personalized account on the paywall until the store confirms a subscription", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("none") });
    await seedStorage({ accountSetup: { completedAt: null } });
    expect(await renderLayout()).toEqual(["paywall"]);
    // A trial starting (or a restore) is reported by the store, and only then does setup move on.
    expect(
      await afterChange(() => fakeSubscriptions.setEntitlement("test-user", entitlementOf("trial"))),
    ).toEqual(["ready"]);
  });

  it("returns to the paywall when a subscription ends while Votic is open", async () => {
    await seedStorage({});
    expect(await renderLayout()).toEqual(APP);
    expect(
      await afterChange(() => fakeSubscriptions.setEntitlement("test-user", entitlementOf("expired"))),
    ).toEqual(["paywall"]);
  });

  it("never treats an unconfirmed subscription as paid", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("unknown") });
    await seedStorage({});
    expect(await renderLayout()).toEqual(["paywall"]);
  });

  it("shows the handoff once after a subscription starts", async () => {
    await seedStorage({ accountSetup: { completedAt: null } });
    expect(await renderLayout()).toEqual(["ready"]);
  });

  it("skips setup when an existing account signs in on a new device or after a reinstall", async () => {
    fakeAuth.reset(null);
    await seedStorage({});
    await renderLayout();
    expect(
      await afterChange(() =>
        fakeAuth.setUser({
          uid: "returning",
          email: "r@example.com",
          displayName: null,
          isNewAccount: false,
        }),
      ),
    ).toEqual(APP);
  });

  it("treats a first launch as new even though other providers save their defaults right away", async () => {
    await renderLayout();
    expect(JSON.parse((await AsyncStorage.getItem(ONBOARDING_KEY)) || "{}")).toMatchObject({
      personalized: false,
      tipsSeen: [],
    });
    expect(currentScreens()).toEqual(["personalize"]);
  });

  it("lets people who used an earlier version go straight to Home", async () => {
    await AsyncStorage.setItem("votic.mobile.first-run-tour.v1", "complete");
    expect(await renderLayout()).toEqual(APP);
    expect(JSON.parse((await AsyncStorage.getItem(ONBOARDING_KEY)) || "{}")).toMatchObject({
      personalized: true,
      checklistDismissed: true,
    });
  });

  it("resumes setup where this account left it", async () => {
    await seedStorage({
      accountSetup: { personalizationCompletedAt: null, completedAt: null, currentStep: 3 },
    });
    expect(await renderLayout()).toEqual(["personalize"]);
    expect((await loadAccountSetup("test-user"))?.currentStep).toBe(3);
  });
});
