import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";
import { PropsWithChildren, ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AccessibilityProvider } from "../src/accessibility/AccessibilityProvider";
import { createDocumentStore } from "../src/documents/documentStorage";
import { DocumentLibraryProvider } from "../src/documents/DocumentLibraryProvider";
import { VoticDocument } from "../src/documents/types";
import { DocumentTransitionProvider } from "../src/navigation/DocumentTransitionProvider";
import { FirstRunTourProvider } from "../src/onboarding/FirstRunTourProvider";
import { PurposeProvider } from "../src/personalization/PurposeProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The same providers as app/_layout.tsx. */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <AccessibilityProvider>
          <PurposeProvider>
            <DocumentLibraryProvider>
              <DocumentTransitionProvider>
                <FirstRunTourProvider>{children}</FirstRunTourProvider>
              </DocumentTransitionProvider>
            </DocumentLibraryProvider>
          </PurposeProvider>
        </AccessibilityProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

type Setup = { documents?: VoticDocument[]; reduceMotion?: boolean };

/** Stores data the way the app does, so providers load it on mount. */
export async function seedStorage({ documents, reduceMotion }: Setup) {
  await AsyncStorage.setItem("votic.mobile.first-run-tour.v1", "complete");
  if (reduceMotion)
    await AsyncStorage.setItem("votic.mobile.accessibility.v1", JSON.stringify({ reduceMotion }));
  if (documents) await createDocumentStore().saveDocuments(documents);
}

/** Renders a screen inside the app's providers, after seeding storage and letting providers load it. */
export async function renderWithProviders(ui: ReactElement, setup: Setup = {}) {
  await seedStorage(setup);
  // React Native Testing Library 14: render, act, and fireEvent are async and must be awaited.
  const result = await render(<AppProviders>{ui}</AppProviders>);
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
