import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Linking, Text } from "react-native";
import CreateAccount from "../../app/create-account";
import ForgotPassword from "../../app/forgot-password";
import Paywall from "../../app/paywall";
import Personalize from "../../app/personalize";
import Ready from "../../app/ready";
import SignIn from "../../app/sign-in";
import Welcome from "../../app/welcome";
import { EXPLORE_SESSION_KEY, useAuth } from "../../src/auth/AuthProvider";
import { walkthrough_key } from "../../src/walkthrough/walkthroughState";
import { useVoticPurpose } from "../../src/personalization/PurposeProvider";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { useAccountSetup } from "../../src/onboarding/AccountSetupProvider";
import { ONBOARDING_KEY, next_tip, parse_onboarding_state } from "../../src/onboarding/OnboardingProvider";
import { load_account_setup } from "../../src/onboarding/onboardingStorage";
import { load_account_preferences } from "../../src/onboarding/accountPreferences";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { useSubscription } from "../../src/subscription/SubscriptionProvider";
import { fakeAuth } from "../mocks/authBackend";
import { router, searchParams } from "../mocks/expoRouter";
import { entitlement_of, fakeSubscriptions, TWO_WEEK_TRIAL_PLAN } from "../mocks/subscriptionService";
import { render_with_providers } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

async function saved_onboarding() {
  return parse_onboarding_state(await AsyncStorage.getItem(ONBOARDING_KEY));
}
const NOT_SET_UP = { accountSetup: { personalizationCompletedAt: null, completedAt: null } };
const NOT_HANDED_OFF = { accountSetup: { completedAt: null } };

describe("Welcome", () => {
  it("welcomes people and offers Create account with email and Sign in", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    expect(screen.getByRole("header", { name: "Make room for\nwhat matters." })).toBeTruthy();
    expect(screen.getByText("A place to read, listen, and keep your ideas.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Create account with email" }));
    expect(router.push).toHaveBeenCalledWith("/create-account");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    // The V flies away first, then Sign in opens.
    await act(async () => jest.advanceTimersByTime(1500));
    expect(router.push).toHaveBeenCalledWith("/sign-in");
  });

  it("links Terms and Privacy only when this build has their addresses", async () => {
    fakeAuth.reset(null);
    fakeSubscriptions.reset({ legal: { termsUrl: "https://votic.app/terms", privacyUrl: null } });
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await render_with_providers(<Welcome />);
    await fireEvent.press(screen.getByRole("link", { name: "Terms" }));
    expect(open).toHaveBeenCalledWith("https://votic.app/terms");
    expect(screen.queryByRole("link", { name: "Privacy Policy" })).toBeNull();
  });
});

function ExploreProbe() {
  const auth = useAuth();
  return (
    <>
      <Text testID="explore-user">{auth.hydrated ? (auth.user?.uid ?? "signed out") : "loading"}</Text>
      <Text accessibilityRole="button" onPress={auth.continueWithoutAccount}>
        Explore
      </Text>
      <Text accessibilityRole="button" onPress={() => void auth.signOut()}>
        Leave
      </Text>
    </>
  );
}

describe("Explore without an account", () => {
  it("is remembered after Votic restarts, until signing out", async () => {
    fakeAuth.reset(null);
    fakeAuth.configured = false;
    await render_with_providers(<ExploreProbe />);
    expect(screen.getByTestId("explore-user").props.children).toBe("signed out");
    await fireEvent.press(screen.getByRole("button", { name: "Explore" }));
    expect(screen.getByTestId("explore-user").props.children).toBe("development");
    await waitFor(async () => expect(await AsyncStorage.getItem(EXPLORE_SESSION_KEY)).toBe("1"));
    screen.unmount();

    await render_with_providers(<ExploreProbe />);
    await waitFor(() => expect(screen.getByTestId("explore-user").props.children).toBe("development"));
    await fireEvent.press(screen.getByRole("button", { name: "Leave" }));
    expect(screen.getByTestId("explore-user").props.children).toBe("signed out");
    await waitFor(async () => expect(await AsyncStorage.getItem(EXPLORE_SESSION_KEY)).toBeNull());
  });
});

describe("Create account", () => {
  it("offers Apple and Google above email", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<CreateAccount />);
    expect(screen.getByText("or continue with email")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(fakeAuth.calls).toContain("signInWithGoogle");
    expect(fakeAuth.user?.uid).toBe("google");
  });

  it("checks the email and password before creating an account", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<CreateAccount />);
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
    expect(screen.getByText("Include at least one uppercase letter.")).toBeTruthy();
    expect(fakeAuth.calls).not.toContain("createAccount");
    await fireEvent.changeText(screen.getByLabelText("Password"), "Reading1");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Include at least one symbol (for example, !, @, or #).")).toBeTruthy();
    expect(fakeAuth.calls).not.toContain("createAccount");
    await fireEvent.changeText(screen.getByLabelText("Password"), "Reading1!");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(fakeAuth.user).toMatchObject({ email: "new@example.com", isNewAccount: true });
  });

  it("offers to sign in when the email already has an account", async () => {
    fakeAuth.reset(null);
    fakeAuth.accounts.set("reader@example.com", "reading1");
    await render_with_providers(<CreateAccount />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "reader@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "Another1!");
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
    await render_with_providers(<SignIn />);
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
    await render_with_providers(<SignIn />);
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
    await render_with_providers(<ForgotPassword />);
    await fireEvent.press(screen.getByRole("button", { name: "Send reset link" }));
    expect(fakeAuth.calls).toContain("sendPasswordReset");
    expect(
      await screen.findByText(/If someone@example.com has a Votic account, a reset link is on its way/),
    ).toBeTruthy();
  });
});

describe("Personalization", () => {
  it("asks four questions, one at a time, and saves the answers for this account", async () => {
    await render_with_providers(<Personalize />, NOT_SET_UP);
    expect(screen.getByRole("progressbar", { name: "Step 1 of 4" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "What should Votic help you with?" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    // Continue waits for a choice; Skip doesn't.
    expect(screen.getByRole("button", { name: "Continue", disabled: true })).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("radio", { name: "Work. Get through reports and find decisions" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    // The reading preview changes as soon as a choice is made.
    expect(screen.getByRole("header", { name: "Make the page your own." })).toBeTruthy();
    const before = JSON.stringify(screen.getByText(/Sign-ups grew this month/).props.style);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Larger text" }));
    expect(JSON.stringify(screen.getByText(/Sign-ups grew this month/).props.style)).not.toBe(before);
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    // "Adapt to the question" is chosen until something else is, and its example shows.
    expect(screen.getByRole("radio", { name: /^Adapt to the question/, checked: true })).toBeTruthy();
    expect(screen.getByText(/The team needs to decide on extra support help/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Simple. Plain words, no jargon" }));
    expect(screen.getByText(/The team needs to choose whether to get more help/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("progressbar", { name: "Step 4 of 4" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Sentences only. A calmer highlight" }));
    await fireEvent.press(screen.getByRole("radio", { name: "1.5× speed" }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    await waitFor(async () =>
      expect((await load_account_setup("test-user"))?.personalizationCompletedAt).toBeTruthy(),
    );
    const setup = await load_account_setup("test-user");
    expect(setup?.answers).toMatchObject({ explanationStyle: "simple", listening: ["highlight-sentence"] });
    expect(setup?.personalizationSkipped).toBe(false);
    // The answers take effect: Ask Votic's explanations, the Reader's highlight, and the starting speed.
    expect(await load_account_preferences("test-user")).toMatchObject({
      explanationStyle: "simple",
      defaultPlaybackRate: 1.5,
      highlightMode: "sentence",
    });
  });

  it("resumes on the same question after Votic is closed", async () => {
    await render_with_providers(<Personalize />, NOT_SET_UP);
    await fireEvent.press(
      screen.getByRole("radio", { name: "Work. Get through reports and find decisions" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await act(async () => {});
    screen.unmount();
    await render_with_providers(<Personalize />, { accountSetup: "none" });
    expect(screen.getByRole("progressbar", { name: "Step 2 of 4" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("radio", { name: "Work. Get through reports and find decisions", checked: true }),
    ).toBeTruthy();
  });

  it("lets every question be skipped, and changes nothing that wasn't answered", async () => {
    await render_with_providers(<Personalize />, NOT_SET_UP);
    for (let step = 0; step < 4; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: "Skip this step" }));
    await waitFor(async () =>
      expect((await load_account_setup("test-user"))?.personalizationSkipped).toBe(true),
    );
    expect(await AsyncStorage.getItem("votic.mobile.explanation-style.v1")).toBeNull();
    expect(await saved_onboarding()).toMatchObject({ personalized: true });
  });

  it("plays a listening sample at the chosen speed", async () => {
    await render_with_providers(<Personalize />, NOT_SET_UP);
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
async function render_paywall() {
  await render_with_providers(
    <>
      <Paywall now={() => new Date(2026, 9, 1)} />
      <AccessProbe />
    </>,
    NOT_HANDED_OFF,
  );
  await act(async () => {});
}

describe("Votic Plus", () => {
  it("shows the store's trial and price and what's included", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await render_paywall();
    expect(screen.getByRole("header", { name: "Make more of every document." })).toBeTruthy();
    expect(screen.getByText("Try Votic Plus free for 2 weeks")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Included with Votic Plus" })).toBeTruthy();
    expect(screen.getByLabelText(/^Ask AI about your documents\. /)).toBeTruthy();
    expect(
      screen.getByText(
        /2 weeks free, then \$9.99\/month. Auto-renews. Cancel anytime in (App Store|Google Play)/,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore Purchases" })).toBeTruthy();
    expect(screen.getByTestId("access").props.children).toBe("false:none");
  });

  it("opens Votic only after the store confirms the trial", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await render_paywall();
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(fakeSubscriptions.calls).toContain("purchase:$rc_monthly");
    // A short welcome plays first; Votic opens when it ends.
    expect(screen.getByRole("header", { name: "You're in." })).toBeTruthy();
    expect(screen.getByTestId("access").props.children).toBe("false:none");
    await waitFor(() => expect(screen.getByTestId("access").props.children).toBe("true:trial"), {
      timeout: 4000,
    });
  });

  it("stays quiet when the purchase sheet is closed, and explains pending and failed purchases", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await render_paywall();
    fakeSubscriptions.nextPurchase = { kind: "cancelled" };
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(screen.queryByRole("alert")).toBeNull();
    fakeSubscriptions.nextPurchase = { kind: "pending" };
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(screen.getByText(/waiting for approval/)).toBeTruthy();
    fakeSubscriptions.nextPurchase = {
      kind: "failed",
      message: "Your purchase couldn't be confirmed. Use Restore Purchases before trying again.",
    };
    await fireEvent.press(screen.getByRole("button", { name: "Start free trial" }));
    expect(
      screen.getByText("Your purchase couldn't be confirmed. Use Restore Purchases before trying again."),
    ).toBeTruthy();
    expect(screen.getByTestId("access").props.children).toBe("false:none");
  });

  it("shows regular pricing for a lapsed subscriber when the store reports no eligible trial", async () => {
    fakeSubscriptions.reset({
      defaultEntitlement: entitlement_of("expired"),
      plans: [{ ...TWO_WEEK_TRIAL_PLAN, trial: null }],
    });
    await render_paywall();
    expect(screen.queryByText(/free for 2 weeks/)).toBeNull();
    expect(screen.getByRole("button", { name: "Subscribe for $9.99/month" })).toBeTruthy();
    expect(screen.getByText(/Your Votic Plus subscription has ended/)).toBeTruthy();
  });

  it("shows regular pricing when the store offers no trial", async () => {
    fakeSubscriptions.reset({
      defaultEntitlement: entitlement_of("none"),
      plans: [{ ...TWO_WEEK_TRIAL_PLAN, trial: null }],
    });
    await render_paywall();
    expect(screen.getByRole("button", { name: "Subscribe for $9.99/month" })).toBeTruthy();
  });

  it("restores a subscription, or says none was found", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await render_paywall();
    await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
    expect(screen.getByText(/No active Votic Plus subscription was found/)).toBeTruthy();
    fakeSubscriptions.restoreResult = entitlement_of("active");
    await fireEvent.press(screen.getByRole("button", { name: "Restore Purchases" }));
    expect(screen.getByRole("header", { name: "Welcome back." })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("access").props.children).toBe("true:active"), {
      timeout: 4000,
    });
  });

  it("offers Try again when the offer can't load", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none"), plans: new Error("offline") });
    await render_paywall();
    expect(screen.getByText(/couldn't load Votic Plus/)).toBeTruthy();
    fakeSubscriptions.plans = [TWO_WEEK_TRIAL_PLAN];
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Start free trial" })).toBeTruthy();
  });

  it("says plainly when this build can't sell subscriptions, with a development-only way past", async () => {
    fakeSubscriptions.reset({ unavailableReason: "expo-go", defaultEntitlement: entitlement_of("none") });
    await render_paywall();
    expect(screen.getByText(/can't be purchased in Expo Go/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start free trial" })).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Continue without a subscription (testing build)" }),
    );
    expect(screen.getByTestId("access").props.children).toBe("true:unknown");
  });

  it("can sign out", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await render_paywall();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out of reader@example.com" }));
    expect(fakeAuth.calls).toContain("signOut");
  });
});

function HandoffProbe() {
  const { handedOff } = useAccountSetup();
  return <Text testID="handoff">{String(handedOff)}</Text>;
}

describe("Votic is ready for you", () => {
  it("makes the next paid step clear and saves completion without granting access", async () => {
    fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
    await render_with_providers(
      <>
        <Ready />
        <HandoffProbe />
        <AccessProbe />
      </>,
      NOT_HANDED_OFF,
    );
    expect(screen.queryByRole("button", { name: "Start using Votic" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "See Votic Plus" }));
    expect(screen.getByTestId("handoff").props.children).toBe("true");
    expect(screen.getByTestId("access").props.children).toBe("false:none");
    await waitFor(async () => expect((await load_account_setup("test-user"))?.completedAt).toBeTruthy());
  });
  it("has one way forward, into Home for a subscriber", async () => {
    await render_with_providers(
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
    await waitFor(async () => expect((await load_account_setup("test-user"))?.completedAt).toBeTruthy());
  });
});

describe("Reading tips", () => {
  it("orders tips so a later one waits for the earlier ones", () => {
    const order = [
      { id: "reader-listen" as const, ready: false },
      { id: "reader-bookmark" as const, ready: true },
    ];
    expect(next_tip(order, [])).toBeNull();
    expect(next_tip(order, ["reader-listen"])).toBe("reader-bookmark");
  });
});

describe("Settings personalization and account", () => {
  it("changes the explanation style", async () => {
    await render_with_providers(<SettingsDetailScreen category="personalization" />);
    await fireEvent.press(screen.getByRole("radio", { name: "Quick" }));
    await waitFor(async () =>
      expect((await load_account_preferences("test-user"))?.explanationStyle).toBe("quick"),
    );
  });

  it("brings walkthroughs and reading tips back from Help", async () => {
    await render_with_providers(<SettingsDetailScreen category="help" />);
    await fireEvent.press(screen.getByRole("button", { name: "Show all walkthroughs and tips again" }));
    expect(screen.getByText(/Walkthroughs and tips will appear again/)).toBeTruthy();
    await waitFor(async () =>
      expect(await saved_onboarding()).toMatchObject({ tipsSeen: [], checklistDismissed: false }),
    );
  });

  it("shows the subscription from the store and restores purchases", async () => {
    fakeSubscriptions.reset({
      defaultEntitlement: entitlement_of("trial", { expiresAt: Date.UTC(2026, 9, 15, 12) }),
    });
    await render_with_providers(<SettingsDetailScreen category="account" />);
    expect(screen.getByText(/^Free trial · ends October 15, 2026$/)).toBeTruthy();
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await fireEvent.press(screen.getByRole("button", { name: "Votic Plus" }));
    expect(openURL).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Restore purchases" }));
    expect(fakeSubscriptions.calls).toContain("restore");
    expect(await screen.findByText("Your Votic Plus subscription is active.")).toBeTruthy();
  });

  it("forgets this account's setup and walkthrough progress when the account is deleted", async () => {
    await render_with_providers(<SettingsDetailScreen category="account" />);
    expect(await load_account_setup("test-user")).not.toBeNull();
    // Deleting takes two confirmations.
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Delete account" })));
    await waitFor(async () => expect(await load_account_setup("test-user")).toBeNull());
    expect(await AsyncStorage.getItem(walkthrough_key("test-user"))).toBeNull();
    expect(fakeAuth.calls).toContain("deleteAccount");
  });
});

it("does not start a delayed listening sample after leaving its step", async () => {
  await render_with_providers(<Personalize />, NOT_SET_UP);
  for (let step = 0; step < 3; step += 1)
    await fireEvent.press(screen.getByRole("button", { name: "Skip this step" }));
  let release: () => void = () => {};
  jest.mocked(Speech.stop).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  jest.mocked(Speech.speak).mockClear();
  await fireEvent.press(screen.getByRole("button", { name: "Play sample" }));
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await act(async () => release());
  expect(Speech.speak).not.toHaveBeenCalled();
});

it("recaps actual reading and listening preferences before the final paywall", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  let purpose!: ReturnType<typeof useVoticPurpose>;
  let access!: ReturnType<typeof useAccessibilityPreferences>;
  function Probe() {
    const currentPurpose = useVoticPurpose();
    const currentAccess = useAccessibilityPreferences();
    useEffect(() => {
      purpose = currentPurpose;
      access = currentAccess;
    }, [currentPurpose, currentAccess]);
    return null;
  }
  await render_with_providers(
    <>
      <Probe />
      <Ready />
    </>,
    NOT_HANDED_OFF,
  );
  await act(async () => {
    purpose.setPurpose("work");
    purpose.setExplanationStyle("simple");
    purpose.setDefaultPlaybackRate(1.5);
    access.setTextSize("large");
    access.setHighlightMode("off");
  });
  expect(screen.getByText("Work")).toBeTruthy();
  expect(screen.getByLabelText("Your reading. Large text · system font")).toBeTruthy();
  expect(screen.getByLabelText("Your listening. Device voice · 1.5× · no highlighting")).toBeTruthy();
  expect(screen.getByLabelText("Your explanations. Simple")).toBeTruthy();
  expect(screen.getByRole("button", { name: "See Votic Plus" })).toBeTruthy();
});
