import AsyncStorage from "@react-native-async-storage/async-storage";
import { render } from "@testing-library/react-native";
import { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AccessibilityProvider } from "../src/accessibility/AccessibilityProvider";
import { DocumentLibraryProvider } from "../src/documents/DocumentLibraryProvider";
import { DocumentTransitionProvider } from "../src/navigation/DocumentTransitionProvider";
import { FirstRunTourProvider } from "../src/onboarding/FirstRunTourProvider";
import { PurposeProvider } from "../src/personalization/PurposeProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Renders a screen inside the same providers as app/_layout.tsx, with the first-run tour already seen. */
export async function renderWithProviders(ui: ReactElement) {
  await AsyncStorage.setItem("votic.mobile.first-run-tour.v1", "complete");
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <AccessibilityProvider>
          <PurposeProvider>
            <DocumentLibraryProvider>
              <DocumentTransitionProvider>
                <FirstRunTourProvider>{ui}</FirstRunTourProvider>
              </DocumentTransitionProvider>
            </DocumentLibraryProvider>
          </PurposeProvider>
        </AccessibilityProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}
