import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Alert, Linking, Text } from "react-native";
import Settings from "../../app/(tabs)/settings";
import CreateAccount from "../../app/create-account";
import ForgotPassword from "../../app/forgot-password";
import Paywall from "../../app/paywall";
import Personalize from "../../app/personalize";
import Ready from "../../app/ready";
import SignIn from "../../app/sign-in";
import Welcome from "../../app/welcome";
import { walkthroughKey } from "../../src/walkthrough/walkthroughState";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { useAccountSetup } from "../../src/onboarding/AccountSetupProvider";
import { GettingStartedCard } from "../../src/onboarding/GettingStartedCard";
import { ONBOARDING_KEY, nextTip, parseOnboardingState } from "../../src/onboarding/OnboardingProvider";
import { loadAccountSetup } from "../../src/onboarding/onboardingStorage";
import { useSubscription } from "../../src/subscription/SubscriptionProvider";
import { fakeAuth } from "../mocks/authBackend";
import { router, searchParams } from "../mocks/expoRouter";
import { entitlementOf, fakeSubscriptions, TWO_WEEK_TRIAL_PLAN } from "../mocks/subscriptionService";
import { renderWithProviders } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

async function savedOnboarding() {
  return parseOnboardingState(await AsyncStorage.getItem(ONBOARDING_KEY));
}
const NOT_SET_UP = { accountSetup: { personalizationCompletedAt: null, completedAt: null } };
const NOT_HANDED_OFF = { accountSetup: { completedAt: null } };

describe("Welcome", () => {
  it("states what Votic does and offers Get started and Sign in", async () => {
    fakeAuth.reset(null);
    await renderWithProviders(<Welcome />);
    expect(screen.getByRole("header", { name: "Make any document easier to read" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Get started" }));
    expect(router.push).toHaveBeenCalledWith("/create-account");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).toHaveBeenCalledWith("/sign-in");
  });

  it("links Terms and Privacy only when this build has their addresses", async () => {
    fakeAuth.reset(null);
    fakeSubscriptions.reset({ legal: { termsUrl: "https://votic.app/terms", privacyUrl: null } });
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await renderWithProviders(<Welcome />);
    await fireEvent.press(screen.getByRole("link", { name: "Terms" }));
    expect(open).toHaveBeenCalledWith("https://votic.app/terms");
    expect(screen.queryByRole("link", { name: "Privacy Policy" })).toBeNull();
  });
});

describe("Create account", () => {
  it("offers Apple and Google above email", async () => {
    fakeAuth.reset(null);
    await renderWithProviders(<CreateAccount />);
    expect(screen.getByText("or continue with email")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(fakeAuth.calls).toContain("signInWithGoogle");
    expect(fakeAuth.user?.uid).toBe("google");
  });

  it("checks the email and password before creating an account", async () => {
    fakeAuth.reset(null);
    await renderWithProviders(<CreateAccount />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "not-an-email");
    await fireEvent.changeText(screen.getByLabelText("Password"), "short");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(fakeAuth.calls).not.toContain("createAccount");

    await fireEvent.press(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText("Password").props.autoComplete).toBe("new-password");
    await fireEvent.changeText(screen.getByLabelText("Email"), "new@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "reading1");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(fakeAuth.user).toMatchObject({ email: "new@example.com", isNewAccount: true });
  });

  it("offers to sign in when the email already has an account", async () => {
    fakeAuth.reset(null);
    fakeAuth.accounts.set("reader@example.com", "reading1");
    await renderWithProviders(<CreateAccount />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "reader@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "another1");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("An account already uses this email. Sign in instead.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Sign in instead" }));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/sign-in",
      params: { email: "reader@example.com" },
    });
  });
});

describe("Sign in", () => {
  it("explains a wrong password without saying whether the account exists, and clears it", async () => {
    fakeAuth.reset(null);
    fakeAuth.accounts.set("reader@example.com", "reading1");
    await renderWithProviders(<SignIn />);
    expect(screen.getByRole("header", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Email"), "reader@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "wrong-pass1");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/That email and password don't match/)).toBeTruthy();
    expect(screen.getByLabelText("Password").props.value).toBe("");
    expect(fakeAuth.user).toBeNull();

    await fireEvent.changeText(screen.getByLabelText("Password"), "reading1");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(fakeAuth.user?.email).toBe("reader@example.com");
  });

  it("carries the email to Forgot password", async () => {
    fakeAuth.reset(null);
    await renderWithProviders(<SignIn />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "reader@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Forgot password?" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/forgot-password",
      params: { email: "reader@example.com" },
    });
  });

  it("sends a reset link and gives the same answer whether or not the account exists", async () => {
    fakeAuth.reset(null);
    searchParams.current = { email: "someone@example.com" };
    await renderWithProviders(<ForgotPassword />);
    await fireEvent.press(screen.getByRole("button", { name: "Send reset link" }));
    expect(fakeAuth.calls).toContain("sendPasswordReset");
    expect(
      await screen.findByText(/If someone@example.com has a Votic account, a reset link is on its way/),
    ).toBeTruthy();
  });
});

describe("Personalization", () => {
  it("asks five questions, one at a time, and saves each answer for this account", async () => {
    await renderWithProviders(<Personalize />, NOT_SET_UP);
    expect(screen.getByRole("progressbar", { name: "Step 1 of 5" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "What would you like Votic to help you do?" })).toBeTruthy();
    expect(screen.getByText("Choose anything that would be helpful. Select all that apply.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Summarize long documents" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Find important information quickly" }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    // "I'll decide as I go" stands alone: choosing it clears the others.
    await fireEvent.press(screen.getByRole("checkbox", { name: "Give me the key points" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "I'll decide as I go" }));
    expect(screen.getByRole("checkbox", { name: "Give me the key points", checked: false })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    // The one pick-one question doesn't say "Select all that apply".
    expect(screen.getByText("Choose one.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Simply. Make it easy to understand." }));
    expect(screen.getByText(/It's the money a business really gets/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    await fireEvent.press(screen.getByRole("checkbox", { name: "Highlight the current sentence" }));
    await fireEvent.press(screen.getByRole("radio", { name: "1.5× speed" }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("progressbar", { name: "Step 5 of 5" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Save important passages" }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    await waitFor(async () =>
      expect((await loadAccountSetup("test-user"))?.personalizationCompletedAt).toBeTruthy(),
    );
    const setup = await loadAccountSetup("test-user");
    expect(setup?.answers).toEqual({
      goals: ["summarize", "find-quickly"],
      readingHelp: ["decide-as-i-go"],
      explanationStyle: "simple",
      listening: ["highlight-sentence"],
      keepingTrack: ["save-passages"],
    });
    expect(setup?.personalizationSkipped).toBe(false);
    // The answers take effect: Ask Votic's explanations, the Reader's highlight, and the starting speed.
    expect(await AsyncStorage.getItem("votic.mobile.explanation-style.v1")).toBe("simple");
    expect(await AsyncStorage.getItem("votic.mobile.default-playback-rate.v1")).toBe("1.5");
    const accessibility = JSON.parse((await AsyncStorage.getItem("votic.mobile.accessibility.v1")) || "{}");
    expect(accessibility).toMatchObject({ highlightMode: "sentence" });
  });

  it("resumes on the same question with the same answers after Votic is closed", async () => {
    await renderWithProviders(<Personalize />, NOT_SET_UP);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Take and organize notes" }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await act(async () => {});
    screen.unmount();
    await renderWithProviders(<Personalize />, { accountSetup: "none" });
    expect(screen.getByRole("progressbar", { name: "Step 2 of 5" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("checkbox", { name: "Take and organize notes", checked: true })).toBeTruthy();
  });

  it("lets every question be skipped, and changes nothing that wasn't answered", async () => {
    await renderWithProviders(<Personalize />, NOT_SET_UP);
    for (let step = 0; step < 5; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: "Skip this step" }));
    await waitFor(async () =>
      expect((await loadAccountSetup("test-user"))?.personalizationSkipped).toBe(true),
    );
    expect(await AsyncStorage.getItem("votic.mobile.explanation-style.v1")).toBeNull();
    expect(await savedOnboarding()).toMatchObject({ personalized: true });
  });

  it("plays a listening sample at the chosen speed", async () => {
    await renderWithProviders(<Personalize />, NOT_SET_UP);
    for (let step = 0; step < 3; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: "Skip this step" }));
    await fireEvent.press(screen.getByRole("radio", { name: "1.2× speed" }));
    await fireEvent.press(screen.getByRole("button", { name: "Play sample" }));
    await waitFor(() => expect(Speech.speak).toHaveBeenCalled());
    expect(jest.mocked(Speech.speak).mock.calls.at(-1)?.[1]).toMatchObject({ rate: 1.2 });
    expect(screen.getByRole("button", { name: "Stop sample" })).toBeTruthy();
  });
});

function AccessProbe() {
  const { access, entitlement } = useSubscription();
  return <Text testID="access">{`${access}:${entitlement.status}`}</Text>;
}
async function renderPaywall() {
  await renderWithProviders(
    <>
      <Paywall now={() => new Date(2026, 9, 1)} />
      <AccessProbe />
    </>,
    NOT_HANDED_OFF,
  );
  await act(async () => {});
}

describe("Votic Premium", () => {
  it("shows the store's trial and price, the timeline, and what's included", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("none") });
    await renderPaywall();
    expect(screen.getByRole("header", { name: "Try Votic Premium free for 2 weeks" })).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("October 15")).toBeTruthy();
    expect(screen.getByLabelText(/^Ask Votic\. .* Included\.$/)).toBeTruthy();
    expect(screen.getByText("2 weeks free, then $9.99/month. Cancel anytime.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore Purchases" })).toBeTruthy();
    expect(screen.getByTestId("access").props.children).toBe("false:none");
  });

  it("opens Votic only after the store confirms the trial", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("none") });
    await renderPaywall();
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(fakeSubscriptions.calls).toContain("purchase:$rc_monthly");
    expect(screen.getByTestId("access").props.children).toBe("true:trial");
  });

  it("stays quiet when the purchase sheet is closed, and explains pending and failed purchases", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("none") });
    await renderPaywall();
    fakeSubscriptions.nextPurchase = { kind: "cancelled" };
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(screen.queryByRole("alert")).toBeNull();
    fakeSubscriptions.nextPurchase = { kind: "pending" };
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(screen.getByText(/waiting for approval/)).toBeTruthy();
    fakeSubscriptions.nextPurchase = {
      kind: "failed",
      message: "Your purchase couldn't be completed. You weren't charged. Please try again.",
    };
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(
      screen.getByText("Your purchase couldn't be completed. You weren't charged. Please try again."),
    ).toBeTruthy();
    expect(screen.getByTestId("access").props.children).toBe("false:none");
  });

  it("never offers the trial again after a subscription has ended", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("expired") });
    await renderPaywall();
    expect(screen.getByRole("header", { name: "Get Votic Premium" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Subscribe for $9.99/month" })).toBeTruthy();
    expect(screen.queryByText("Today")).toBeNull();
    expect(screen.getByText(/Your Votic Premium subscription has ended/)).toBeTruthy();
  });

  it("shows regular pricing when the store offers no trial", async () => {
    fakeSubscriptions.reset({
      defaultEntitlement: entitlementOf("none"),
      plans: [{ ...TWO_WEEK_TRIAL_PLAN, trial: null }],
    });
    await renderPaywall();
    expect(screen.getByRole("button", { name: "Subscribe for $9.99/month" })).toBeTruthy();
  });

  it("restores a subscription, or says none was found", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("none") });
    await renderPaywall();
    await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
    expect(screen.getByText(/No active Votic Premium subscription was found/)).toBeTruthy();
    fakeSubscriptions.restoreResult = entitlementOf("active");
    await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
    expect(screen.getByTestId("access").props.children).toBe("true:active");
  });

  it("offers Try again when the offer can't load", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("none"), plans: new Error("offline") });
    await renderPaywall();
    expect(screen.getByText(/couldn't load Votic Premium/)).toBeTruthy();
    fakeSubscriptions.plans = [TWO_WEEK_TRIAL_PLAN];
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Start free trial" })).toBeTruthy();
  });

  it("says plainly when this build can't sell subscriptions, with a development-only way past", async () => {
    fakeSubscriptions.reset({ unavailableReason: "expo-go", defaultEntitlement: entitlementOf("none") });
    await renderPaywall();
    expect(screen.getByText(/can't be purchased in Expo Go/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start free trial" })).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Continue without a subscription (development build)" }),
    );
    expect(screen.getByTestId("access").props.children).toBe("true:unknown");
  });

  it("can sign out", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("none") });
    await renderPaywall();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out of reader@example.com" }));
    expect(fakeAuth.calls).toContain("signOut");
  });
});

function HandoffProbe() {
  const { handedOff } = useAccountSetup();
  return <Text testID="handoff">{String(handedOff)}</Text>;
}

describe("Votic is ready for you", () => {
  it("has one way forward, into Home", async () => {
    await renderWithProviders(
      <>
        <Ready />
        <HandoffProbe />
      </>,
      NOT_HANDED_OFF,
    );
    expect(screen.getByRole("header", { name: "Votic is ready for you" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add your first document" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Start using Votic" }));
    expect(screen.getByTestId("handoff").props.children).toBe("true");
    await waitFor(async () => expect((await loadAccountSetup("test-user"))?.completedAt).toBeTruthy());
  });
});

function LibraryCount() {
  const { documents } = useDocumentLibrary();
  return <Text testID="library-count">{documents.map((document) => document.title).join("|")}</Text>;
}

describe("Getting started", () => {
  it("offers a first action and adds the Votic guide when chosen", async () => {
    await renderWithProviders(
      <>
        <GettingStartedCard />
        <LibraryCount />
      </>,
      { onboarding: { checklistDismissed: false } },
    );
    expect(screen.getByRole("header", { name: "Welcome, Sam" })).toBeTruthy();
    expect(screen.getByLabelText("Add a document, not done yet")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try the Votic guide" }));
    expect(screen.getByTestId("library-count").props.children).toBe("Votic guide");
    expect(screen.getByLabelText("Add a document, done")).toBeTruthy();
    // With a document in the library, the card switches from first actions to the remaining steps.
    expect(screen.queryByRole("button", { name: "Try the Votic guide" })).toBeNull();
    expect(screen.getByText("3 quick steps to get the most from Votic.")).toBeTruthy();
  });

  it("can be hidden", async () => {
    await renderWithProviders(<GettingStartedCard />, { onboarding: { checklistDismissed: false } });
    await fireEvent.press(screen.getByRole("button", { name: "Hide getting started" }));
    expect(screen.queryByRole("button", { name: "Hide getting started" })).toBeNull();
    await waitFor(async () => expect((await savedOnboarding())?.checklistDismissed).toBe(true));
  });

  it("orders tips so a later one waits for the earlier ones", () => {
    const order = [
      { id: "reader-listen" as const, ready: false },
      { id: "reader-bookmark" as const, ready: true },
    ];
    expect(nextTip(order, [])).toBeNull();
    expect(nextTip(order, ["reader-listen"])).toBe("reader-bookmark");
  });
});

describe("Settings personalization and account", () => {
  it("changes the explanation style, and brings walkthroughs and the checklist back", async () => {
    await renderWithProviders(<Settings />);
    await fireEvent.press(screen.getByRole("radio", { name: "Quick" }));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem("votic.mobile.explanation-style.v1")).toBe("quick"),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Show all walkthroughs and tips again" }));
    expect(screen.getByText(/Getting Started checklist will appear again/)).toBeTruthy();
    await waitFor(async () =>
      expect(await savedOnboarding()).toMatchObject({ tipsSeen: [], checklistDismissed: false }),
    );
  });

  it("shows the subscription from the store and restores purchases", async () => {
    fakeSubscriptions.reset({
      defaultEntitlement: entitlementOf("trial", { expiresAt: Date.UTC(2026, 9, 15, 12) }),
    });
    await renderWithProviders(<Settings />);
    expect(screen.getByText(/^Free trial · ends October 15, 2026$/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Restore purchases" }));
    expect(fakeSubscriptions.calls).toContain("restore");
    expect(await screen.findByText("Your Votic Premium subscription is active.")).toBeTruthy();
  });

  it("signs out after confirming", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === "Sign out")?.onPress?.();
    });
    await renderWithProviders(<Settings />);
    expect(screen.getByText("Signed in as reader@example.com")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Sign out" })));
    expect(alert).toHaveBeenCalled();
    expect(fakeAuth.calls).toContain("signOut");
  });

  it("forgets this account's setup and walkthrough progress when the account is deleted", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === "Delete account")?.onPress?.();
    });
    await renderWithProviders(<Settings />);
    expect(await loadAccountSetup("test-user")).not.toBeNull();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Delete account" })));
    await waitFor(async () => expect(await loadAccountSetup("test-user")).toBeNull());
    expect(await AsyncStorage.getItem(walkthroughKey("test-user"))).toBeNull();
    expect(fakeAuth.calls).toContain("deleteAccount");
  });
});
