import { jest, it, expect } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { useSubscription } from "../../src/subscription/SubscriptionProvider";
import { useAccountSetup } from "../../src/onboarding/AccountSetupProvider";
import { useVoticPurpose } from "../../src/personalization/PurposeProvider";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { Entitlement } from "../../src/subscription/subscriptionTypes";
import { EMPTY_ANSWERS, newOnboardingState } from "../../src/onboarding/onboardingModel";
import { saveAccountSetup } from "../../src/onboarding/onboardingStorage";
import * as subscriptions from "../mocks/subscriptionService";
import { fakeAuth } from "../mocks/authBackend";
import { renderWithProviders } from "../renderWithProviders";
import AsyncStorage from "@react-native-async-storage/async-storage";

it("migrates old device preferences into the restored session without copying them into the next account", async () => {
  await AsyncStorage.setItem("votic.mobile.explanation-style.v1", "detailed");
  await AsyncStorage.setItem("votic.mobile.default-playback-rate.v1", "1.7");
  await AsyncStorage.setItem("votic.mobile.accessibility.v1", JSON.stringify({ highlightMode: "word" }));
  function Probe() {
    const purpose = useVoticPurpose();
    const access = useAccessibilityPreferences();
    return (
      <Text testID="migration">{`${purpose.explanationStyle}:${purpose.defaultPlaybackRate}:${access.highlightMode}`}</Text>
    );
  }
  await renderWithProviders(<Probe />);
  expect(screen.getByTestId("migration").props.children).toBe("detailed:1.7:word");
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {});
  expect(screen.getByTestId("migration").props.children).toBe("adaptive:1:both");
});

it("rejects old-account store events while and after the next account is identified", async () => {
  let callback: (value: Entitlement, uid: string) => void = () => {};
  let finishB: (value: Entitlement) => void = () => {};
  const create = subscriptions.createSubscriptionService;
  jest.spyOn(subscriptions, "createSubscriptionService").mockImplementation(() => {
    const service = create();
    return {
      ...service,
      identify: (uid) =>
        uid === "B"
          ? new Promise((resolve) => {
              finishB = resolve;
            })
          : service.identify(uid),
      onChange: (listener) => {
        callback = listener;
        return () => {};
      },
    };
  });
  function Probe() {
    const sub = useSubscription();
    return <Text testID="sub">{JSON.stringify({ access: sub.access, checking: sub.checking })}</Text>;
  }
  const read = () => JSON.parse(screen.getByTestId("sub").props.children);
  await renderWithProviders(<Probe />);
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => callback(subscriptions.entitlementOf("active"), "test-user"));
  expect(read()).toEqual({ access: false, checking: true });
  await act(async () => finishB(subscriptions.entitlementOf("none")));
  await act(async () => callback(subscriptions.entitlementOf("active"), "test-user"));
  expect(read()).toEqual({ access: false, checking: false });
  await act(async () => callback(subscriptions.entitlementOf("trial"), "B"));
  expect(read()).toEqual({ access: true, checking: false });
});

it("a refresh begun for the previous account cannot grant Premium to the next account", async () => {
  let finish: (value: Entitlement) => void = () => {};
  const create = subscriptions.createSubscriptionService;
  jest.spyOn(subscriptions, "createSubscriptionService").mockImplementation(() => ({
    ...create(),
    refresh: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  }));
  let subscription: ReturnType<typeof useSubscription>;
  function Probe() {
    subscription = useSubscription();
    return <Text testID="access">{String(subscription.access)}</Text>;
  }
  subscriptions.fakeSubscriptions.setEntitlement("B", subscriptions.entitlementOf("none"));
  await renderWithProviders(<Probe />);
  let pending: Promise<Entitlement>;
  await act(async () => {
    pending = subscription!.refresh();
  });
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {
    finish(subscriptions.entitlementOf("active"));
    await pending!;
  });
  expect(screen.getByTestId("access").props.children).toBe("false");
});

it("restores each account's answers and effective preferences, including subsequent Settings overrides", async () => {
  let setup: ReturnType<typeof useAccountSetup>;
  let purpose: ReturnType<typeof useVoticPurpose>;
  let access: ReturnType<typeof useAccessibilityPreferences>;
  function Probe() {
    setup = useAccountSetup();
    purpose = useVoticPurpose();
    access = useAccessibilityPreferences();
    return (
      <Text testID="prefs">
        {JSON.stringify({
          saved: setup.setup?.answers.explanationStyle,
          effective: purpose.explanationStyle,
          highlight: access.highlightMode,
          rate: purpose.defaultPlaybackRate,
        })}
      </Text>
    );
  }
  const read = () => JSON.parse(screen.getByTestId("prefs").props.children);
  await renderWithProviders(<Probe />);
  await act(async () => {
    setup!.savePersonalization({
      ...EMPTY_ANSWERS,
      explanationStyle: "simple",
      listening: ["highlight-sentence"],
    });
    purpose!.setDefaultPlaybackRate(1.5);
  });
  await saveAccountSetup("B", { ...newOnboardingState(), personalizationCompletedAt: 1, completedAt: 1 });
  await act(async () => fakeAuth.setUser(null));
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {});
  expect(read()).toMatchObject({ effective: "adaptive", highlight: "both", rate: 1 });
  await act(async () => {
    setup!.savePersonalization({
      ...EMPTY_ANSWERS,
      explanationStyle: "detailed",
      listening: ["highlight-words"],
    });
    purpose!.setDefaultPlaybackRate(2);
  });
  await act(async () => fakeAuth.setUser({ uid: "test-user", email: null, displayName: null }));
  await act(async () => {});
  expect(read()).toEqual({ saved: "simple", effective: "simple", highlight: "sentence", rate: 1.5 });
  await act(async () => {
    purpose!.setExplanationStyle("quick");
    access!.setHighlightMode("off");
  });
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {});
  expect(read()).toEqual({ saved: "detailed", effective: "detailed", highlight: "word", rate: 2 });
  await act(async () => fakeAuth.setUser({ uid: "test-user", email: null, displayName: null }));
  await act(async () => {});
  expect(read()).toEqual({ saved: "simple", effective: "quick", highlight: "off", rate: 1.5 });
});
