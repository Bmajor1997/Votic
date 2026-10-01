import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ThemeProvider, useVoticTheme } from "../src/theme/ThemeProvider";
import {
  AccessibilityProvider,
  useAccessibilityPreferences,
} from "../src/accessibility/AccessibilityProvider";
import { ActivityProvider } from "../src/activity/ActivityProvider";
import { AuthProvider, useAuth } from "../src/auth/AuthProvider";
import { DocumentLibraryProvider } from "../src/documents/DocumentLibraryProvider";
import { DocumentTransitionProvider } from "../src/navigation/DocumentTransitionProvider";
import { OnboardingProvider, useOnboarding } from "../src/onboarding/OnboardingProvider";
import { PurposeProvider } from "../src/personalization/PurposeProvider";

// Keep the launch screen up until Votic knows whether to show Welcome, personalization, or Home.
Promise.resolve(SplashScreen.preventAutoHideAsync?.()).catch(() => {});

function ThemedStack() {
  const { theme } = useVoticTheme();
  const { user, hydrated } = useAuth();
  const { personalized } = useOnboarding();
  const { reduceMotion } = useAccessibilityPreferences();
  useEffect(() => {
    if (hydrated) Promise.resolve(SplashScreen.hideAsync?.()).catch(() => {});
  }, [hydrated]);
  if (!hydrated) return null;
  const signedIn = Boolean(user);
  return (
    <DocumentLibraryProvider>
      <DocumentTransitionProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
            animation: "none",
          }}
        >
          {/* Only the screens for the current stage exist, so the router always lands on the right one. */}
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="welcome" />
            <Stack.Screen
              name="sign-in"
              options={{ animation: reduceMotion ? "none" : "slide_from_right" }}
            />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !personalized}>
            <Stack.Screen name="personalize" options={{ animation: reduceMotion ? "none" : "fade" }} />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && personalized}>
            <Stack.Screen name="(tabs)" options={{ animation: reduceMotion ? "none" : "fade" }} />
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
            <Stack.Screen
              name="statistics"
              options={{ animation: reduceMotion ? "none" : "slide_from_right" }}
            />
          </Stack.Protected>
        </Stack>
      </DocumentTransitionProvider>
    </DocumentLibraryProvider>
  );
}

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <ThemeProvider>
        <AccessibilityProvider>
          <PurposeProvider>
            <AuthProvider>
              <ActivityProvider>
                <ThemedStack />
              </ActivityProvider>
            </AuthProvider>
          </PurposeProvider>
        </AccessibilityProvider>
      </ThemeProvider>
    </OnboardingProvider>
  );
}
