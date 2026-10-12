import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import RootLayout from "../../app/_layout";
import { ONBOARDING_KEY } from "../../src/onboarding/OnboardingProvider";
import { load_account_setup } from "../../src/onboarding/onboardingStorage";
import { fakeAuth } from "../mocks/authBackend";
import { stackScreens } from "../mocks/expoRouter";
import { entitlement_of, fakeSubscriptions } from "../mocks/subscriptionService";
import { seed_storage } from "../renderWithProviders";

/** The distinct screens the layout declares right now (screens register again on every render). */
function current_screens() {
  return [...new Set(stackScreens.map((screen) => screen.name))];
}
async function render_layout() {
  await render(<RootLayout />);
  await act(async () => {});
  return current_screens();
}
async function after_change(change: () => void | Promise<void>) {
  stackScreens.length = 0;
  await act(async () => {
    await change();
  });
  await act(async () => {});
  return current_screens();
}
const APP = [
  "(tabs)",
  "reader",
  "assistant",
  "settings/[category]",
  "review",
  "recap",
  "handle-share",
  "statistics",
  "home-screen-widgets",
  "widget",
  "account",
];

describe("root navigation", () => {
  it("opens the Reader over the current screen without a competing stack animation", async () => {
    await seed_storage({});
    await render_layout();
    const reader = stackScreens.find((screen) => screen.name === "reader");
    // transparentModal keeps the source screen mounted so the Reader can grow out of the tapped card.
    expect(reader?.options).toMatchObject({
      animation: "none",
      presentation: "transparentModal",
      contentStyle: { backgroundColor: "transparent" },
    });
    expect(current_screens()).toEqual(APP);
  });

  it("shows only Welcome and the account screens to someone who is signed out", async () => {
    fakeAuth.reset(null);
    await seed_storage({});
    expect(await render_layout()).toEqual(["welcome", "create-account", "sign-in", "forgot-password"]);
  });

  it("sends a newly created account to personalization", async () => {
    fakeAuth.reset(null);
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await seed_storage({});
    expect(await render_layout()).toEqual(["welcome", "create-account", "sign-in", "forgot-password"]);
    expect(
      await after_change(() =>
        fakeAuth.setUser({ uid: "new", email: "new@example.com", displayName: null, isNewAccount: true }),
      ),
    ).toEqual(["personalize", "account"]);
    const setup = await load_account_setup("new");
    expect(setup?.personalizationCompletedAt).toBeNull();
  });

  it("keeps a personalized account on the paywall until the store confirms a subscription", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await seed_storage({ accountSetup: { completedAt: null } });
    expect(await render_layout()).toEqual(["paywall", "account"]);
    // A trial starting (or a restore) is reported by the store, and only then does setup move on.
    expect(
      await after_change(() => fakeSubscriptions.setEntitlement("test-user", entitlement_of("trial"))),
    ).toEqual(["widgets-intro", "account"]);
  });

  it("returns to the paywall when a subscription ends while Votic is open", async () => {
    await seed_storage({});
    expect(await render_layout()).toEqual(APP);
    expect(
      await after_change(() => fakeSubscriptions.setEntitlement("test-user", entitlement_of("expired"))),
    ).toEqual(["paywall", "account"]);
  });

  it("never treats an unconfirmed subscription as paid", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("unknown") });
    await seed_storage({});
    expect(await render_layout()).toEqual(["paywall", "account"]);
  });

  it("introduces the Home Screen widgets, then shows the handoff once, after a subscription starts", async () => {
    await seed_storage({ accountSetup: { completedAt: null } });
    expect(await render_layout()).toEqual(["widgets-intro", "account"]);
  });

  it("goes on to the handoff once the widgets have been introduced", async () => {
    await seed_storage({ accountSetup: { completedAt: null, widgetsIntroducedAt: 1 } });
    expect(await render_layout()).toEqual(["ready", "account"]);
  });

  it("skips setup when an existing account signs in on a new device or after a reinstall", async () => {
    fakeAuth.reset(null);
    await seed_storage({});
    await render_layout();
    expect(
      await after_change(() =>
        fakeAuth.setUser({
          uid: "returning",
          email: "r@example.com",
          displayName: null,
          isNewAccount: false,
        }),
      ),
    ).toEqual(APP);
  });

  it("protects Settings details and honors Reduce Motion for their navigation", async () => {
    await seed_storage({ reduceMotion: true });
    await render_layout();
    expect(
      stackScreens.filter((screen) => screen.name === "settings/[category]").at(-1)?.options,
    ).toMatchObject({
      animation: "none",
    });
  });

  it("treats a first launch as new even though other providers save their defaults right away", async () => {
    await render_layout();
    expect(JSON.parse((await AsyncStorage.getItem(ONBOARDING_KEY)) || "{}")).toMatchObject({
      personalized: false,
      tipsSeen: [],
    });
    expect(current_screens()).toEqual(["personalize", "account"]);
  });

  it("lets people who used an earlier version go straight to Home", async () => {
    await AsyncStorage.setItem("votic.mobile.first-run-tour.v1", "complete");
    expect(await render_layout()).toEqual(APP);
    expect(JSON.parse((await AsyncStorage.getItem(ONBOARDING_KEY)) || "{}")).toMatchObject({
      personalized: true,
      checklistDismissed: true,
    });
  });

  it("resumes setup where this account left it", async () => {
    await seed_storage({
      accountSetup: { personalizationCompletedAt: null, completedAt: null, currentStep: 3 },
    });
    expect(await render_layout()).toEqual(["personalize", "account"]);
    expect((await load_account_setup("test-user"))?.currentStep).toBe(3);
  });
});
