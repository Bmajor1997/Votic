import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { act, render, screen } from "@testing-library/react-native";
import RootLayout from "../../app/_layout";
import { ONBOARDING_KEY } from "../../src/onboarding/OnboardingProvider";
import { load_account_preferences } from "../../src/onboarding/accountPreferences";
import { INTRO_KEY, parse_intro } from "../../src/onboarding/introModel";
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
  "paywall",
  "reader",
  "assistant",
  "settings/[category]",
  "recap",
  "scan",
  "import-web",
  "pronunciations",
  "voices",
  "handle-share",
  "statistics",
  "ai-usage",
  "home-screen-widgets",
  "widgets-tip",
  "widget",
  "support",
  "subscription",
  "account",
  "library-backup",
  "recently-deleted",
  "note-drafts",
  "feedback/index",
  "feedback/feature",
  "feedback/bug",
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
        fakeAuth.set_user({ uid: "new", email: "new@example.com", displayName: null, isNewAccount: true }),
      ),
    ).toEqual([
      "personalize",
      "support",
      "subscription",
      "account",
      "library-backup",
      "recently-deleted",
      "note-drafts",
      "feedback/index",
      "feedback/feature",
      "feedback/bug",
    ]);
    const setup = await load_account_setup("new");
    expect(setup?.personalizationCompletedAt).toBeNull();
  });

  it("lets Free users enter the app and view the paywall", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await seed_storage({});
    expect(await render_layout()).toEqual(APP);
    await screen.unmount();
    stackScreens.length = 0;
    expect((await render_layout())[0]).toBe("(tabs)");
    expect(
      await after_change(() => fakeSubscriptions.set_entitlement("test-user", entitlement_of("trial"))),
    ).toEqual(APP);
  });

  it("keeps library screens accessible when Plus expires", async () => {
    await seed_storage({});
    expect(await render_layout()).toEqual(APP);
    expect(
      await after_change(() => fakeSubscriptions.set_entitlement("test-user", entitlement_of("expired"))),
    ).toEqual(APP);
  });

  it("allows Free access when a subscription cannot be confirmed", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("unknown") });
    await seed_storage({});
    expect(await render_layout()).toEqual(APP);
  });

  it("introduces widgets before requesting a subscription", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await seed_storage({ accountSetup: { completedAt: null } });
    expect(await render_layout()).toEqual([
      "widgets-intro",
      "support",
      "subscription",
      "account",
      "library-backup",
      "recently-deleted",
      "note-drafts",
      "feedback/index",
      "feedback/feature",
      "feedback/bug",
    ]);
  });

  it("goes on to the handoff once the widgets have been introduced", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await seed_storage({ accountSetup: { completedAt: null, widgetsIntroducedAt: 1 } });
    expect(await render_layout()).toEqual([
      "ready",
      "support",
      "subscription",
      "account",
      "library-backup",
      "recently-deleted",
      "note-drafts",
      "feedback/index",
      "feedback/feature",
      "feedback/bug",
    ]);
  });

  it("skips setup when an existing account signs in on a new device or after a reinstall", async () => {
    fakeAuth.reset(null);
    await seed_storage({});
    await render_layout();
    expect(
      await after_change(() =>
        fakeAuth.set_user({
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
    expect(current_screens()).toEqual([
      "personalize",
      "support",
      "subscription",
      "account",
      "library-backup",
      "recently-deleted",
      "note-drafts",
      "feedback/index",
      "feedback/feature",
      "feedback/bug",
    ]);
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
    expect(await render_layout()).toEqual([
      "personalize",
      "support",
      "subscription",
      "account",
      "library-backup",
      "recently-deleted",
      "note-drafts",
      "feedback/index",
      "feedback/feature",
      "feedback/bug",
    ]);
    expect((await load_account_setup("test-user"))?.currentStep).toBe(3);
  });

  describe("first-launch tour", () => {
    const NEW_ACCOUNT = { uid: "new", email: "new@example.com", displayName: null, isNewAccount: true };
    const SIGNED_IN_ONLY = [
      "support",
      "subscription",
      "account",
      "library-backup",
      "recently-deleted",
      "note-drafts",
      "feedback/index",
      "feedback/feature",
      "feedback/bug",
    ];
    async function finished_tour(entry: "create" | "sign-in") {
      await AsyncStorage.setItem(
        INTRO_KEY,
        JSON.stringify({
          done: true,
          toured: true,
          entry,
          purpose: "work",
          highlightMode: "sentence",
          defaultPlaybackRate: 1.5,
        }),
      );
    }

    it("shows a new install only the tour", async () => {
      fakeAuth.reset(null);
      await seed_storage({ onboarding: { personalized: false } });
      expect(await render_layout()).toEqual(["intro"]);
    });

    it("gives the tour's answers to the account made after it and skips the questions", async () => {
      fakeAuth.reset(null);
      fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
      await seed_storage({ onboarding: { personalized: false } });
      await finished_tour("create");
      expect(await render_layout()).toEqual(["welcome", "create-account", "sign-in", "forgot-password"]);
      expect(await after_change(() => fakeAuth.set_user(NEW_ACCOUNT))).toEqual(["ready", ...SIGNED_IN_ONLY]);
      const setup = await load_account_setup("new");
      expect(setup?.personalizationCompletedAt).not.toBeNull();
      expect(setup?.widgetsAfterFirstDocument).toBe(true);
      expect(await load_account_preferences("new")).toMatchObject({
        purpose: "work",
        highlightMode: "sentence",
        defaultPlaybackRate: 1.5,
      });
      expect(parse_intro(await AsyncStorage.getItem(INTRO_KEY)).claimedBy).toBe("new");
    });

    it("asks the usual questions when a new account came through I already have an account", async () => {
      fakeAuth.reset(null);
      fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
      await seed_storage({ onboarding: { personalized: false } });
      await finished_tour("sign-in");
      await render_layout();
      expect(await after_change(() => fakeAuth.set_user(NEW_ACCOUNT))).toEqual([
        "personalize",
        ...SIGNED_IN_ONLY,
      ]);
    });

    it("never gives the tour's answers to an existing account", async () => {
      fakeAuth.reset(null);
      fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
      await seed_storage({ onboarding: { personalized: false }, accountSetup: "none" });
      await finished_tour("create");
      await render_layout();
      await after_change(() => fakeAuth.set_user({ ...NEW_ACCOUNT, uid: "old", isNewAccount: false }));
      expect(await load_account_preferences("old")).not.toMatchObject({ purpose: "work" });
      expect(parse_intro(await AsyncStorage.getItem(INTRO_KEY)).claimedBy).toBeNull();
    });
  });
});
