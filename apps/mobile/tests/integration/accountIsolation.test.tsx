import { useActivity } from "../../src/activity/ActivityProvider";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { createDocumentStore, LIBRARY_KEY } from "../../src/documents/documentStorage";
import { accountStorageKey } from "../../src/storage/accountStorage";
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
import { renderWithProviders, testDocument } from "../renderWithProviders";
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

it("isolates documents, notes, collections and pending activity saves when accounts switch", async () => {
  let library: ReturnType<typeof useDocumentLibrary>;
  let activity: ReturnType<typeof useActivity>;
  function Probe() {
    library = useDocumentLibrary();
    activity = useActivity();
    return (
      <Text testID="account-library">
        {JSON.stringify({
          titles: library.documents.map((document) => document.title),
          collections: library.collections,
          ask: activity.measuredLog.ask.length,
        })}
      </Text>
    );
  }
  const read = () => JSON.parse(screen.getByTestId("account-library").props.children);
  await renderWithProviders(<Probe />);
  await act(async () => {
    library!.addTextDocument("private.txt", "Account A text.");
    library!.addCollection("Private collection");
    library!.addQuickNote({
      id: "private-note",
      sentenceIndex: 0,
      text: "",
      note: "Account A note",
      createdAt: 1,
      updatedAt: 1,
    });
    activity!.recordAsk({ at: 1, category: "summary", newConversation: true });
  });
  const oldLibrary = library!;
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {});
  expect(read()).toEqual({ titles: [], collections: [], ask: 0 });
  await act(async () => oldLibrary.addTextDocument("stale.txt", "Stale text."));
  await act(async () => jest.advanceTimersByTime(2500));
  expect(read()).toEqual({ titles: [], collections: [], ask: 0 });
  expect(await createDocumentStore("B").loadDocuments()).toEqual([]);
  await act(async () => fakeAuth.setUser({ uid: "test-user", email: null, displayName: null }));
  await act(async () => {});
  expect(read()).toEqual({ titles: ["Quick Notes", "private"], collections: ["Private collection"], ask: 1 });
  expect((await createDocumentStore("test-user").loadDocuments())[0].savedPassages?.[0].note).toBe(
    "Account A note",
  );
  await act(async () => fakeAuth.setUser(null));
  expect(read()).toEqual({ titles: [], collections: [], ask: 0 });
});

it("does not show the previous library while the new account's storage read is delayed", async () => {
  await createDocumentStore("B").saveDocuments([testDocument("b", "B book")]);
  let release: (value: string | null) => void = () => {};
  const getItem = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
  jest.spyOn(AsyncStorage, "getItem").mockImplementation((key) =>
    key === accountStorageKey(LIBRARY_KEY, "B")
      ? new Promise((resolve) => {
          release = resolve;
        })
      : getItem(key),
  );
  function Probe() {
    const { documents, loaded } = useDocumentLibrary();
    return (
      <Text testID="delayed-library">
        {JSON.stringify({ titles: documents.map((document) => document.title), loaded })}
      </Text>
    );
  }
  await renderWithProviders(<Probe />, { documents: [testDocument("a", "A book")] });
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  expect(JSON.parse(screen.getByTestId("delayed-library").props.children)).toEqual({
    titles: [],
    loaded: false,
  });
  await act(async () => fakeAuth.setUser({ uid: "test-user", email: null, displayName: null }));
  await act(async () => release(null));
  expect(JSON.parse(screen.getByTestId("delayed-library").props.children)).toEqual({
    titles: ["A book"],
    loaded: true,
  });
});
