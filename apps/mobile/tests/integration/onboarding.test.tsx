import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { AppServices } from "../../src/config/appServices";
import { createDocumentStore } from "../../src/documents/documentStorage";
import { EntryGate } from "../../src/onboarding/EntryGate";
import {
  DEVICE_HISTORY_KEY,
  loadDeviceHistory,
  loadOnboardingState,
} from "../../src/onboarding/onboardingStorage";
import { RESEND_COOLDOWN_SECONDS } from "../../src/onboarding/screens/VerifyEmailScreen";
import {
  createFakeAuth,
  createFakeSubscriptions,
  entitlementOf,
  MONTHLY_TRIAL_PLAN,
} from "../mocks/accountServices";
import { renderWithProviders, testDocument } from "../renderWithProviders";

const APP = "Votic home";

function services(
  auth = createFakeAuth(),
  subscriptions = createFakeSubscriptions(),
): AppServices & { fakeAuth: typeof auth; fakeStore: typeof subscriptions } {
  return {
    auth: auth.service,
    subscriptions: subscriptions.service,
    legal: { termsUrl: "https://votic.app/terms", privacyUrl: "https://votic.app/privacy" },
    fakeAuth: auth,
    fakeStore: subscriptions,
  };
}

async function settle() {
  for (let i = 0; i < 6; i += 1) await act(async () => {});
}

async function renderGate(
  appServices: AppServices,
  {
    isDevelopment = false,
    documents,
  }: { isDevelopment?: boolean; documents?: ReturnType<typeof testDocument>[] } = {},
) {
  const result = await renderWithProviders(
    <EntryGate>
      <Text>{APP}</Text>
    </EntryGate>,
    { services: appServices, isDevelopment, documents },
  );
  await settle();
  return result;
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
  await settle();
}
async function type(label: string, value: string) {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}
async function createAccount(email = "new@example.com", password = "reading123") {
  await press("Create Account");
  await type("First name", "Ava");
  await type("Email address", email);
  await type("Password", password);
  await type("Confirm password", password);
  await press("Create Account");
}
async function signIn(email: string, password = "reading123") {
  await press("Sign In");
  await type("Email", email);
  await type("Password", password);
  await press("Sign In");
}
/** Taps a choice card (checkbox or radio) by its label. */
async function choose(name: string) {
  await fireEvent.press(screen.getByLabelText(name));
  await settle();
}
/** A new account, created and verified, on the first personalization question. */
async function newVerifiedUser(appServices = services()) {
  await renderGate(appServices);
  await createAccount("ava@example.com");
  appServices.fakeAuth.verify("ava@example.com");
  await press("I've Verified My Email");
  return appServices;
}

async function answerAllAndContinue() {
  await choose("Understand something I'm reading");
  await choose("Summarize long documents");
  await press("Continue");
  await choose("Give me the key points");
  await press("Continue");
  await choose("Simply. Make it easy to understand.");
  await press("Continue");
  await choose("Highlight the words as they're read");
  await press("Continue");
  await choose("Help me create notes");
  await press("Continue");
}

beforeEach(async () => {
  await AsyncStorage.setItem(DEVICE_HISTORY_KEY, "new");
});

describe("Welcome and accounts", () => {
  it("welcomes signed-out people with only working sign-in options", async () => {
    await renderGate(services());
    expect(screen.getByText("Welcome to Votic")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeTruthy();
    expect(screen.queryByText(/Google|Apple/)).toBeNull();
    expect(screen.queryByText(APP)).toBeNull();
  });

  it("creates an account and asks the person to verify their email", async () => {
    const app = services();
    await renderGate(app);
    await createAccount();
    expect(app.fakeAuth.calls.signUps).toBe(1);
    expect(app.fakeAuth.calls.verificationEmails).toBe(1);
    expect(screen.getByText("Check your email")).toBeTruthy();
    expect(screen.getByText(/new@example\.com/)).toBeTruthy();
  });

  it("validates the form before contacting the server", async () => {
    const app = services();
    await renderGate(app);
    await press("Create Account");
    await type("Email address", "not-an-email");
    await type("Password", "short");
    await type("Confirm password", "different");
    await press("Create Account");
    expect(screen.getByText("Enter your first name.")).toBeTruthy();
    expect(screen.getByText("Enter a valid email address, like name@example.com.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(screen.getByText("Passwords don't match.")).toBeTruthy();
    expect(app.fakeAuth.calls.signUps).toBe(0);
  });

  it("shows and hides the password", async () => {
    await renderGate(services());
    await press("Create Account");
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
    await press("Show password");
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
    await press("Hide password");
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  });

  it("starts only one sign-up when Create Account is tapped twice", async () => {
    const app = services();
    await renderGate(app);
    await press("Create Account");
    await type("First name", "Ava");
    await type("Email address", "new@example.com");
    await type("Password", "reading123");
    await type("Confirm password", "reading123");
    const button = screen.getByRole("button", { name: "Create Account" });
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    await settle();
    expect(app.fakeAuth.calls.signUps).toBe(1);
  });

  it("explains an email that can't be used without saying whether an account exists", async () => {
    const app = services();
    app.fakeAuth.add({ email: "taken@example.com" });
    await renderGate(app);
    await createAccount("taken@example.com");
    expect(screen.getByText(/can't be used to create a new account/)).toBeTruthy();
  });

  it("signs in a returning person", async () => {
    const app = services(createFakeAuth(), createFakeSubscriptions({ entitlements: {} }));
    const account = app.fakeAuth.add({ email: "sam@example.com" });
    app.fakeStore.setEntitlement(account.uid, entitlementOf("active"));
    await renderGate(app);
    await signIn("sam@example.com");
    expect(screen.getByText(APP)).toBeTruthy();
  });

  it("rejects wrong credentials with one message for any cause", async () => {
    const app = services();
    app.fakeAuth.add({ email: "sam@example.com" });
    await renderGate(app);
    await signIn("sam@example.com", "wrong-password1");
    const message = "That email and password don't match. Check them and try again.";
    expect(screen.getByText(message)).toBeTruthy();
    await type("Email", "nobody@example.com");
    await type("Password", "reading123");
    await press("Sign In");
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText(APP)).toBeNull();
  });

  it("sends a password reset link and reads the same for unknown emails", async () => {
    const app = services();
    await renderGate(app);
    await press("Sign In");
    await type("Email", "who@example.com");
    await press("Forgot Password?");
    expect(screen.getByLabelText("Email").props.value).toBe("who@example.com");
    await press("Send Reset Link");
    expect(app.fakeAuth.calls.resetEmails).toEqual(["who@example.com"]);
    expect(screen.getByText(/If there's a Votic account for who@example\.com/)).toBeTruthy();
    await press("Back to Sign In");
    expect(screen.getByText("Welcome back")).toBeTruthy();
  });
});

describe("Email verification", () => {
  it("waits for verification, limits resends, and continues once verified", async () => {
    const app = services();
    await renderGate(app);
    await createAccount();
    const resend = () => screen.getByRole("button", { name: /Resend/ });
    expect(resend().props.accessibilityState.disabled).toBe(true);
    await press("I've Verified My Email");
    expect(screen.getByText(/isn't verified yet/)).toBeTruthy();
    for (let i = 0; i < RESEND_COOLDOWN_SECONDS; i += 1)
      await act(async () => jest.advanceTimersByTime(1000));
    expect(resend().props.accessibilityState.disabled).toBe(false);
    await press("Resend Email");
    expect(app.fakeAuth.calls.verificationEmails).toBe(2);
    expect(resend().props.accessibilityState.disabled).toBe(true);
    app.fakeAuth.verify("new@example.com");
    await press("I've Verified My Email");
    expect(screen.getByText("What would you like Votic to help you do?")).toBeTruthy();
  });

  it("lets someone fix a mistyped email by starting over", async () => {
    const app = services();
    await renderGate(app);
    await createAccount("typo@exmaple.com");
    await press("Use a different email");
    expect(screen.getByText("Create your Votic account")).toBeTruthy();
    await createAccount("typo@exmaple.com");
    // The mistyped account was removed, so the same address can be used again.
    expect(screen.getByText("Check your email")).toBeTruthy();
  });
});

describe("Personalization", () => {
  it("asks all five questions with their choices", async () => {
    await newVerifiedUser();
    expect(screen.getByText("MAKE VOTIC WORK FOR YOU")).toBeTruthy();
    expect(
      screen.getByText("Choose how you'd like Votic to help. You can change any of this later."),
    ).toBeTruthy();
    const seen: string[] = [];
    for (let step = 0; step < 5; step += 1) {
      expect(screen.getByLabelText(`Step ${step + 1} of 5`)).toBeTruthy();
      seen.push(screen.getByRole("header").props.children);
      if (step < 4) await press("Skip for now");
    }
    expect(seen).toEqual([
      "What would you like Votic to help you do?",
      "How can Votic make reading easier for you?",
      "When Votic explains something, how would you like it explained?",
      "What would make listening more useful for you?",
      "How should Votic help you keep track of important things?",
    ]);
    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
  });

  it("allows several choices, and stand-alone choices clear the others", async () => {
    await newVerifiedUser();
    await press("Skip for now");
    await choose("Give me the key points");
    await choose("Read the document aloud");
    const checked = () =>
      screen.getAllByRole("checkbox").filter((item) => item.props.accessibilityState.checked).length;
    expect(checked()).toBe(2);
    await choose("I'll decide as I go");
    expect(checked()).toBe(1);
    await choose("Give me the key points");
    expect(
      screen.getByRole("checkbox", { name: "I'll decide as I go" }).props.accessibilityState.checked,
    ).toBe(false);
  });

  it("keeps one explanation style selected", async () => {
    await newVerifiedUser();
    await press("Skip for now");
    await press("Skip for now");
    await choose("Quickly. Just give me the answer.");
    await choose("In detail. Give me more context.");
    const selected = screen.getAllByRole("radio").filter((item) => item.props.accessibilityState.checked);
    expect(selected.map((item) => item.props.accessibilityLabel)).toEqual([
      "In detail. Give me more context.",
    ]);
  });

  it("keeps answers when going back", async () => {
    await newVerifiedUser();
    await choose("Summarize long documents");
    await press("Continue");
    await choose("Give me the key points");
    await press("Continue");
    await press("Previous question");
    await press("Previous question");
    expect(
      screen.getByRole("checkbox", { name: "Summarize long documents" }).props.accessibilityState.checked,
    ).toBe(true);
    await press("Continue");
    expect(
      screen.getByRole("checkbox", { name: "Give me the key points" }).props.accessibilityState.checked,
    ).toBe(true);
  });

  it("can be skipped entirely, using defaults", async () => {
    const app = await newVerifiedUser();
    await press("Skip setup");
    expect(screen.getByText("Start your free trial")).toBeTruthy();
    const saved = await loadOnboardingState(app.fakeAuth.currentUid!);
    expect(saved).toMatchObject({ personalizationSkipped: true, answers: { explanationStyle: null } });
    expect(saved?.personalizationCompletedAt).toEqual(expect.any(Number));
  });

  it("resumes on the same question with the same answers after Votic closes", async () => {
    const app = await newVerifiedUser();
    await choose("Listen instead of read");
    await press("Continue");
    await choose("Help me pick up where I left off");
    screen.unmount();
    await renderGate(app);
    expect(screen.getByText("How can Votic make reading easier for you?")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Help me pick up where I left off" }).props.accessibilityState
        .checked,
    ).toBe(true);
    await press("Previous question");
    expect(
      screen.getByRole("checkbox", { name: "Listen instead of read" }).props.accessibilityState.checked,
    ).toBe(true);
  });

  it("saves the answers and applies the listening choice to the Reader right away", async () => {
    const app = await newVerifiedUser();
    await answerAllAndContinue();
    const saved = await loadOnboardingState(app.fakeAuth.currentUid!);
    expect(saved?.answers).toEqual({
      goals: ["understand-reading", "summarize"],
      readingHelp: ["key-points"],
      explanationStyle: "simple",
      listening: ["highlight-words"],
      keepingTrack: ["create-notes"],
    });
    expect(saved?.version).toBe(1);
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem("votic.mobile.accessibility.v1"))!).highlightMode).toBe(
      "word",
    );
  });
});

describe("Paywall", () => {
  async function toPaywall(app = services()) {
    await newVerifiedUser(app);
    await answerAllAndContinue();
    return app;
  }

  it("follows personalization, keeps the answers, and shows the store's real terms", async () => {
    const app = await toPaywall();
    expect(screen.getByText("Start your free trial")).toBeTruthy();
    expect(screen.getByText("Try Votic free, then continue with your Votic subscription.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start Free Trial" })).toBeTruthy();
    expect(screen.getByText("7 days free, then $4.99/month. Cancel anytime.")).toBeTruthy();
    expect(screen.getByText(/renews automatically at \$4\.99 per month until you cancel/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore Purchases" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Terms of Service" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Privacy Policy" })).toBeTruthy();
    // Value statements follow what the person chose ("Understand", "Summarize").
    expect(screen.getByText("Understand difficult documents")).toBeTruthy();
    expect((await loadOnboardingState(app.fakeAuth.currentUid!))?.answers.goals).toEqual([
      "understand-reading",
      "summarize",
    ]);
  });

  it("shows a 14-day trial when the store is configured for one", async () => {
    await toPaywall(
      services(
        createFakeAuth(),
        createFakeSubscriptions({ plans: [{ ...MONTHLY_TRIAL_PLAN, trial: { count: 14, unit: "day" } }] }),
      ),
    );
    expect(screen.getByText("14 days free, then $4.99/month. Cancel anytime.")).toBeTruthy();
  });

  it("starts a free trial, then shows the ready screen once, then Votic", async () => {
    const app = await toPaywall();
    await press("Start Free Trial");
    expect(app.fakeStore.calls.purchases).toBe(1);
    expect(screen.getByText("Votic is ready for you, Ava.")).toBeTruthy();
    await press("Start Using Votic");
    expect(screen.getByText(APP)).toBeTruthy();
    screen.unmount();
    await renderGate(app);
    expect(screen.getByText(APP)).toBeTruthy();
  });

  it("grants access after a subscription without a trial", async () => {
    const plan = { ...MONTHLY_TRIAL_PLAN, trial: null };
    const app = await toPaywall(services(createFakeAuth(), createFakeSubscriptions({ plans: [plan] })));
    expect(screen.getByText("Subscribe to Votic")).toBeTruthy();
    app.fakeStore.setNextPurchase({ kind: "purchased", entitlement: entitlementOf("active") });
    await press("Subscribe");
    await press("Start Using Votic");
    expect(screen.getByText(APP)).toBeTruthy();
  });

  it("stays on the paywall when the purchase is cancelled, fails, or is pending", async () => {
    const app = await toPaywall();
    app.fakeStore.setNextPurchase({ kind: "cancelled" });
    await press("Start Free Trial");
    expect(screen.getByText("Start your free trial")).toBeTruthy();
    app.fakeStore.setNextPurchase({
      kind: "failed",
      message: "Your purchase couldn't be completed. You weren't charged. Please try again.",
    });
    await press("Start Free Trial");
    expect(screen.getByText(/You weren't charged/)).toBeTruthy();
    app.fakeStore.setNextPurchase({ kind: "pending" });
    await press("Start Free Trial");
    expect(screen.getByText(/waiting for approval/)).toBeTruthy();
    expect(screen.queryByText(APP)).toBeNull();
    // Nothing about setup was lost.
    expect((await loadOnboardingState(app.fakeAuth.currentUid!))?.answers.explanationStyle).toBe("simple");
  });

  it("restores a subscription bought earlier", async () => {
    const app = await toPaywall();
    await press("Restore Purchases");
    expect(screen.getByText(/No active Votic subscription was found/)).toBeTruthy();
    app.fakeStore.setEntitlement(app.fakeAuth.currentUid!, entitlementOf("active"));
    await press("Restore Purchases");
    expect(screen.getByText(/Votic is ready for you/)).toBeTruthy();
  });

  it("sends people with an ended subscription back to the paywall without promising another trial", async () => {
    const app = await toPaywall();
    await press("Start Free Trial");
    await press("Start Using Votic");
    await act(async () => app.fakeStore.setEntitlement(app.fakeAuth.currentUid!, entitlementOf("expired")));
    await settle();
    expect(
      screen.getByText("Your Votic subscription has ended. Subscribe again to keep using Votic."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeTruthy();
    expect(screen.queryByText(/free/)).toBeNull();
  });

  it("keeps the subscription with the account across sign-out and sign-in", async () => {
    const app = await toPaywall();
    await press("Start Free Trial");
    await press("Start Using Votic");
    await act(async () => {
      await app.auth.signOut();
    });
    await settle();
    expect(app.fakeStore.calls.resets).toBe(1);
    await signIn("ava@example.com");
    expect(screen.getByText(APP)).toBeTruthy();
  });

  it("restores access after a reinstall or on a new device without repeating setup", async () => {
    const app = await toPaywall();
    await press("Start Free Trial");
    screen.unmount();
    // Reinstalling clears the app's storage and Firebase's saved session; the store keeps the purchase.
    await AsyncStorage.clear();
    const reinstalled = services(createFakeAuth(), app.fakeStore);
    reinstalled.fakeAuth.add({ email: "ava@example.com", uid: app.fakeAuth.currentUid! });
    await renderGate(reinstalled);
    await signIn("ava@example.com");
    expect(screen.getByText(APP)).toBeTruthy();
  });

  it("lets development builds past an unconfigured paywall, but never release builds", async () => {
    const unconfigured = () =>
      services(createFakeAuth(), createFakeSubscriptions({ unavailableReason: "not-configured" }));
    await newVerifiedUser(unconfigured());
    await press("Skip setup");
    expect(screen.getByText(/Subscriptions aren't set up in this version of Votic yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start Free Trial|Subscribe/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /development build/ })).toBeNull();
    screen.unmount();

    const dev = unconfigured();
    dev.fakeAuth.add({ email: "ava@example.com" });
    await renderGate(dev, { isDevelopment: true });
    await signIn("ava@example.com");
    await press("Continue without a subscription (development build)");
    expect(screen.getByText(APP)).toBeTruthy();
  });
});

describe("Existing Votic users", () => {
  it("detects an install that already has documents and skips setup and the paywall", async () => {
    await AsyncStorage.removeItem(DEVICE_HISTORY_KEY);
    const documents = [testDocument("doc-1", "Biology")];
    const app = services();
    await renderGate(app, { documents });
    expect(screen.getByText("Welcome to Votic")).toBeTruthy();
    await createAccount("longtime@example.com");
    app.fakeAuth.verify("longtime@example.com");
    await press("I've Verified My Email");
    expect(screen.getByText(APP)).toBeTruthy();
    expect(app.fakeStore.calls.purchases).toBe(0);
    expect(await AsyncStorage.getItem(DEVICE_HISTORY_KEY)).toBe("existing");
    expect((await createDocumentStore().loadDocuments()).map((document) => document.title)).toEqual([
      "Biology",
    ]);
  });

  it("treats a fresh install as new even after the library saves its empty list", async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem("votic.mobile.library.v2", "[]");
    await AsyncStorage.setItem("votic.mobile.collections.v1", "[]");
    await AsyncStorage.setItem("votic.mobile.theme.v1", JSON.stringify({ accentName: "orange" }));
    expect(await loadDeviceHistory()).toBe("new");
    // Remembered, so documents added later don't turn a new account into a grandfathered one.
    await AsyncStorage.setItem("votic.mobile.purpose.v1", "work");
    expect(await loadDeviceHistory()).toBe("new");
  });

  it("recognizes an install whose first-run tour was finished", async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem("votic.mobile.first-run-tour.v1", "complete");
    expect(await loadDeviceHistory()).toBe("existing");
  });

  it("keeps documents and notes on the device after signing out", async () => {
    await AsyncStorage.setItem(DEVICE_HISTORY_KEY, "existing");
    const documents = [
      testDocument("doc-1", "Biology", {
        savedPassages: [
          { id: "p", sentenceIndex: 0, text: "Cells.", note: "Mitosis", createdAt: 1, updatedAt: 1 },
        ],
      }),
    ];
    const app = services(createFakeAuth({ signedIn: { email: "sam@example.com" } }));
    await renderGate(app, { documents });
    expect(screen.getByText(APP)).toBeTruthy();
    await act(async () => {
      await app.auth.signOut();
    });
    await settle();
    expect(screen.getByText("Welcome to Votic")).toBeTruthy();
    const kept = await createDocumentStore().loadDocuments();
    expect(kept[0].savedPassages?.[0].note).toBe("Mitosis");
  });
});
