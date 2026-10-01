import { Stack } from "expo-router";
import { ThemeProvider, useVoticTheme } from "../src/theme/ThemeProvider";
import { AccessibilityProvider } from "../src/accessibility/AccessibilityProvider";
import { DocumentLibraryProvider } from "../src/documents/DocumentLibraryProvider";
import { DocumentTransitionProvider } from "../src/navigation/DocumentTransitionProvider";
import { FirstRunTourProvider } from "../src/onboarding/FirstRunTourProvider";
import { PurposeProvider } from "../src/personalization/PurposeProvider";
import { AccountProvider } from "../src/onboarding/AccountProvider";
import { EntryGate } from "../src/onboarding/EntryGate";
import { WalkthroughProvider } from "../src/walkthrough/WalkthroughProvider";

function ThemedStack() {
  const { theme } = useVoticTheme();
  return (
    <DocumentLibraryProvider>
      <DocumentTransitionProvider>
        <FirstRunTourProvider>
          <EntryGate>
            <WalkthroughProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.background },
                  animation: "none",
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="reader"
                  options={{
                    animation: "none",
                    presentation: "transparentModal",
                    gestureEnabled: false,
                    contentStyle: { backgroundColor: "transparent" },
                  }}
                />
                <Stack.Screen name="assistant" />
                <Stack.Screen name="review" />
                <Stack.Screen name="recap" />
              </Stack>
            </WalkthroughProvider>
          </EntryGate>
        </FirstRunTourProvider>
      </DocumentTransitionProvider>
    </DocumentLibraryProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AccessibilityProvider>
        <PurposeProvider>
          <AccountProvider>
            <ThemedStack />
          </AccountProvider>
        </PurposeProvider>
      </AccessibilityProvider>
    </ThemeProvider>
  );
}
