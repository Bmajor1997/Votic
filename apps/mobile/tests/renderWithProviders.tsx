import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";
import { PropsWithChildren, ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AccessibilityProvider } from "../src/accessibility/AccessibilityProvider";
import { ActivityProvider } from "../src/activity/ActivityProvider";
import { AuthProvider } from "../src/auth/AuthProvider";
import { createDocumentStore } from "../src/documents/documentStorage";
import { DocumentLibraryProvider } from "../src/documents/DocumentLibraryProvider";
import { VoticDocument } from "../src/documents/types";
import { DocumentTransitionProvider } from "../src/navigation/DocumentTransitionProvider";
import { AccountSetupProvider } from "../src/onboarding/AccountSetupProvider";
import { OnboardingState as AccountSetupState, newOnboardingState } from "../src/onboarding/onboardingModel";
import { saveAccountSetup } from "../src/onboarding/onboardingStorage";
import {
  DEVICE_HISTORY_KEY,
  ONBOARDING_KEY,
  OnboardingProvider,
  OnboardingState,
  TIP_IDS,
} from "../src/onboarding/OnboardingProvider";
import { PurposeProvider } from "../src/personalization/PurposeProvider";
import { SubscriptionProvider } from "../src/subscription/SubscriptionProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { FLOWS } from "../src/walkthrough/walkthroughFlows";
import { MeasureNode, WalkthroughProvider } from "../src/walkthrough/WalkthroughProvider";
import { WALKTHROUGH_KEY } from "../src/walkthrough/walkthroughState";
import { fakeAuth } from "./mocks/authBackend";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The same providers as app/_layout.tsx. */
export function AppProviders({ children, measureNode }: PropsWithChildren<{ measureNode?: MeasureNode }>) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <OnboardingProvider>
        <ThemeProvider>
          <AccessibilityProvider>
            <PurposeProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <AccountSetupProvider>
                    <ActivityProvider>
                      <DocumentLibraryProvider>
                        <DocumentTransitionProvider>
                          <WalkthroughProvider measureNode={measureNode}>{children}</WalkthroughProvider>
                        </DocumentTransitionProvider>
                      </DocumentLibraryProvider>
                    </ActivityProvider>
                  </AccountSetupProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </PurposeProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}

type Setup = {
  documents?: VoticDocument[];
  reduceMotion?: boolean;
  /** Defaults to someone who has finished onboarding and seen every tip. */
  onboarding?: Partial<OnboardingState>;
  /** The signed-in account's setup. Defaults to finished; "none" leaves nothing saved. */
  accountSetup?: Partial<AccountSetupState> | "none";
  /** "fresh" starts with no walkthroughs seen; by default they're all finished so they don't cover the screen. */
  walkthrough?: "fresh" | "finished";
  measureNode?: MeasureNode;
};

/** Stores data the way the app does, so providers load it on mount. */
export async function seedStorage({
  documents,
  reduceMotion,
  onboarding,
  accountSetup = {},
  walkthrough = "finished",
}: Setup) {
  const state: OnboardingState = {
    personalized: true,
    tipsSeen: [...TIP_IDS],
    checklistDismissed: true,
    askedVotic: false,
    ...onboarding,
  };
  await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  // Fresh walkthroughs are for a new install unless the test has said otherwise.
  if (walkthrough === "fresh" && !(await AsyncStorage.getItem(DEVICE_HISTORY_KEY)))
    await AsyncStorage.setItem(DEVICE_HISTORY_KEY, "new");
  const uid = fakeAuth.user?.uid;
  if (uid && accountSetup !== "none")
    await saveAccountSetup(uid, {
      ...newOnboardingState(),
      personalizationCompletedAt: 1,
      completedAt: 1,
      ...accountSetup,
    });
  if (walkthrough === "finished")
    await AsyncStorage.setItem(
      WALKTHROUGH_KEY,
      JSON.stringify({
        version: 1,
        flows: Object.fromEntries(Object.keys(FLOWS).map((id) => [id, { status: "completed", at: 1 }])),
      }),
    );
  if (reduceMotion)
    await AsyncStorage.setItem("votic.mobile.accessibility.v1", JSON.stringify({ reduceMotion }));
  if (documents) await createDocumentStore().saveDocuments(documents);
}

/** Renders a screen inside the app's providers, after seeding storage and letting providers load it. */
export async function renderWithProviders(ui: ReactElement, setup: Setup = {}) {
  await seedStorage(setup);
  // React Native Testing Library 14: render, act, and fireEvent are async and must be awaited.
  const result = await render(<AppProviders measureNode={setup.measureNode}>{ui}</AppProviders>);
  await act(async () => {});
  return result;
}

export function testDocument(id: string, title: string, extra: Partial<VoticDocument> = {}): VoticDocument {
  return {
    id,
    title,
    sourceName: `${title}.pdf`,
    plainText: `${title} opening sentence. ${title} second sentence.`,
    importedAt: 1,
    updatedAt: 1,
    progress: 0,
    sentenceIndex: 0,
    wordIndex: 0,
    playbackRate: 1,
    savedPassages: [],
    ...extra,
  };
}
