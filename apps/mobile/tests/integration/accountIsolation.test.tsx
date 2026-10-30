import { useActivity } from "../../src/activity/ActivityProvider";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { create_document_store, LIBRARY_KEY } from "../../src/documents/documentStorage";
import { account_storage_key } from "../../src/storage/accountStorage";
import { jest, it, expect } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { useSubscription } from "../../src/subscription/SubscriptionProvider";
import { useAccountSetup } from "../../src/onboarding/AccountSetupProvider";
import { useVoticPurpose } from "../../src/personalization/PurposeProvider";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { Entitlement } from "../../src/subscription/subscriptionTypes";
import { EMPTY_ANSWERS, new_onboarding_state } from "../../src/onboarding/onboardingModel";
import { save_account_setup } from "../../src/onboarding/onboardingStorage";
import * as subscriptions from "../mocks/subscriptionService";
import { fakeAuth } from "../mocks/authBackend";
import { render_with_providers, test_document } from "../renderWithProviders";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { account_preferences_key, load_account_preferences } from "../../src/onboarding/accountPreferences";
import { ask_suggestions, DEFAULT_ASK_SUGGESTIONS } from "../../src/personalization/suggestions";

it("migrates old device preferences into the restored session without copying them into the next account", async () => {
  await AsyncStorage.setItem("votic.mobile.purpose.v1", "work");
  await AsyncStorage.setItem("votic.mobile.explanation-style.v1", "detailed");
  await AsyncStorage.setItem("votic.mobile.default-playback-rate.v1", "1.7");
  await AsyncStorage.setItem("votic.mobile.accessibility.v1", JSON.stringify({ highlightMode: "word" }));
  function Probe() {
    const purpose = useVoticPurpose();
    const access = useAccessibilityPreferences();
    return (
      <Text testID="migration">{`${purpose.purpose}:${purpose.explanationStyle}:${purpose.defaultPlaybackRate}:${access.highlightMode}`}</Text>
    );
  }
  await render_with_providers(<Probe />);
  expect(screen.getByTestId("migration").props.children).toBe("work:detailed:1.7:word");
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {});
  expect(screen.getByTestId("migration").props.children).toBe("null:adaptive:1:both");
});

it("keeps what each account said Votic should help with, so a new account on the same phone starts fresh", async () => {
  let purpose: ReturnType<typeof useVoticPurpose>;
  function Probe() {
    purpose = useVoticPurpose();
    return <Text testID="purpose">{String(purpose.purpose)}</Text>;
  }
  const shown = () => screen.getByTestId("purpose").props.children;
  await render_with_providers(<Probe />);
  await act(async () => purpose!.setPurpose("work"));
  expect(shown()).toBe("work");
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {});
  expect(shown()).toBe("null");
  expect(ask_suggestions(null, purpose!.purpose)).toEqual(DEFAULT_ASK_SUGGESTIONS);
  await act(async () => purpose!.setPurpose("learning"));
  await act(async () => fakeAuth.setUser({ uid: "test-user", email: null, displayName: null }));
  await act(async () => {});
  expect(shown()).toBe("work");
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {});
  expect(shown()).toBe("learning");
});

it("gives preferences saved before the purpose moved per account the device's purpose only in the restored session", async () => {
  await AsyncStorage.setItem("votic.mobile.purpose.v1", "personal");
  const saved = { explanationStyle: "quick", highlightMode: "both", defaultPlaybackRate: 1 };
  await AsyncStorage.setItem(account_preferences_key("test-user"), JSON.stringify(saved));
  await AsyncStorage.setItem(account_preferences_key("B"), JSON.stringify(saved));
  function Probe() {
    return <Text testID="purpose">{String(useVoticPurpose().purpose)}</Text>;
  }
  await render_with_providers(<Probe />);
  expect(screen.getByTestId("purpose").props.children).toBe("personal");
  expect(await load_account_preferences("test-user")).toMatchObject({ purpose: "personal" });
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {});
  expect(screen.getByTestId("purpose").props.children).toBe("null");
  expect(await load_account_preferences("B")).toMatchObject({ purpose: null });
});

it("rejects old-account store events while and after the next account is identified", async () => {
  let callback: (value: Entitlement, uid: string) => void = () => {};
  let finish_b: (value: Entitlement) => void = () => {};
  const create = subscriptions.create_subscription_service;
  jest.spyOn(subscriptions, "create_subscription_service").mockImplementation(() => {
    const service = create();
    return {
      ...service,
      identify: (uid) =>
        uid === "B"
          ? new Promise((resolve) => {
              finish_b = resolve;
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
  await render_with_providers(<Probe />);
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => callback(subscriptions.entitlement_of("active"), "test-user"));
  expect(read()).toEqual({ access: false, checking: true });
  await act(async () => finish_b(subscriptions.entitlement_of("none")));
  await act(async () => callback(subscriptions.entitlement_of("active"), "test-user"));
  expect(read()).toEqual({ access: false, checking: false });
  await act(async () => callback(subscriptions.entitlement_of("trial"), "B"));
  expect(read()).toEqual({ access: true, checking: false });
});

it("a refresh begun for the previous account cannot grant Premium to the next account", async () => {
  let finish: (value: Entitlement) => void = () => {};
  const create = subscriptions.create_subscription_service;
  jest.spyOn(subscriptions, "create_subscription_service").mockImplementation(() => ({
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
  subscriptions.fakeSubscriptions.setEntitlement("B", subscriptions.entitlement_of("none"));
  await render_with_providers(<Probe />);
  let pending: Promise<Entitlement>;
  await act(async () => {
    pending = subscription!.refresh();
  });
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  await act(async () => {
    finish(subscriptions.entitlement_of("active"));
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
  await render_with_providers(<Probe />);
  await act(async () => {
    setup!.savePersonalization({
      ...EMPTY_ANSWERS,
      explanationStyle: "simple",
      listening: ["highlight-sentence"],
    });
    purpose!.setDefaultPlaybackRate(1.5);
  });
  await save_account_setup("B", { ...new_onboarding_state(), personalizationCompletedAt: 1, completedAt: 1 });
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
  await render_with_providers(<Probe />);
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
  expect(await create_document_store("B").loadDocuments()).toEqual([]);
  await act(async () => fakeAuth.setUser({ uid: "test-user", email: null, displayName: null }));
  await act(async () => {});
  expect(read()).toEqual({ titles: ["Quick Notes", "private"], collections: ["Private collection"], ask: 1 });
  expect((await create_document_store("test-user").loadDocuments())[0].savedPassages?.[0].note).toBe(
    "Account A note",
  );
  await act(async () => fakeAuth.setUser(null));
  expect(read()).toEqual({ titles: [], collections: [], ask: 0 });
});

it("does not show the previous library while the new account's storage read is delayed", async () => {
  await create_document_store("B").saveDocuments([test_document("b", "B book")]);
  let release: (value: string | null) => void = () => {};
  const getItem = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
  jest.spyOn(AsyncStorage, "getItem").mockImplementation((key) =>
    key === account_storage_key(LIBRARY_KEY, "B")
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
  await render_with_providers(<Probe />, { documents: [test_document("a", "A book")] });
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
it("keeps testing bypasses with their account and ignores the unowned legacy device flag", async () => {
  subscriptions.fakeSubscriptions.reset({ unavailableReason: "expo-go" });
  await AsyncStorage.setItem("votic.mobile.development-paywall-bypass.v1", "yes");
  let subscription: ReturnType<typeof useSubscription>;
  function Probe() {
    subscription = useSubscription();
    return (
      <Text testID="bypass">
        {JSON.stringify({ access: subscription.access, checking: subscription.checking })}
      </Text>
    );
  }
  const read = () => JSON.parse(screen.getByTestId("bypass").props.children);
  await render_with_providers(<Probe />);
  expect(read()).toEqual({ access: false, checking: false });
  await act(async () => subscription!.bypass());
  expect(read().access).toBe(true);
  expect(
    await AsyncStorage.getItem(
      account_storage_key("votic.mobile.development-paywall-bypass.v1", "test-user"),
    ),
  ).toBe("yes");
  const staleBypass = subscription!.bypass;
  await act(async () => fakeAuth.setUser({ uid: "B", email: null, displayName: null }));
  expect(read()).toEqual({ access: false, checking: false });
  await act(async () => staleBypass());
  expect(read().access).toBe(false);
  await act(async () => fakeAuth.setUser({ uid: "test-user", email: null, displayName: null }));
  expect(read()).toEqual({ access: true, checking: false });
  await act(async () => subscription!.resetBypass());
  expect(read()).toEqual({ access: false, checking: false });
  expect(
    await AsyncStorage.getItem(
      account_storage_key("votic.mobile.development-paywall-bypass.v1", "test-user"),
    ),
  ).toBeNull();
});

it("reads a purpose Votic no longer offers (Research, Accessibility) as not chosen", async () => {
  await AsyncStorage.setItem("votic.mobile.purpose.v1", "research");
  await AsyncStorage.setItem(
    account_preferences_key("test-user"),
    JSON.stringify({
      purpose: "accessibility",
      explanationStyle: "quick",
      highlightMode: "both",
      defaultPlaybackRate: 1,
    }),
  );
  function Probe() {
    return <Text testID="purpose">{String(useVoticPurpose().purpose)}</Text>;
  }
  await render_with_providers(<Probe />);
  expect(screen.getByTestId("purpose").props.children).toBe("null");
  expect(await load_account_preferences("test-user")).toMatchObject({
    purpose: null,
    explanationStyle: "quick",
  });
});
