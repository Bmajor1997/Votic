import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SetupAccent, ThemeProvider, useVoticTheme } from "../src/theme/ThemeProvider";
import {
  AccessibilityProvider,
  useAccessibilityPreferences,
} from "../src/accessibility/AccessibilityProvider";
import { ActivityProvider } from "../src/activity/ActivityProvider";
import { AuthProvider, useAuth } from "../src/auth/AuthProvider";
import { DocumentLibraryProvider } from "../src/documents/DocumentLibraryProvider";
import { DocumentTransitionProvider } from "../src/navigation/DocumentTransitionProvider";
import { AccountSetupProvider, useAccountSetup } from "../src/onboarding/AccountSetupProvider";
import { OnboardingProvider } from "../src/onboarding/OnboardingProvider";
import { PurposeProvider } from "../src/personalization/PurposeProvider";
import { SubscriptionProvider, useSubscription } from "../src/subscription/SubscriptionProvider";
import { WalkthroughProvider } from "../src/walkthrough/WalkthroughProvider";

// Keep the launch screen up until Votic knows whether to show Welcome, setup, or Home.
Promise.resolve(SplashScreen.preventAutoHideAsync?.()).catch(() => {});

function ThemedStack() {
  const { theme } = useVoticTheme();
  const { user, hydrated } = useAuth();
  const setup = useAccountSetup();
  const subscription = useSubscription();
  const { reduceMotion } = useAccessibilityPreferences();
  useEffect(() => {
    if (hydrated) Promise.resolve(SplashScreen.hideAsync?.()).catch(() => {});
  }, [hydrated]);
  if (!hydrated) return null;
  const signedIn = Boolean(user);
  const personalized = signedIn && setup.personalized;
  // Signing in, finishing setup, and subscribing are separate facts. Only the store grants access.
  const subscribed = personalized && subscription.access;
  // Wait for this account's setup, and for a returning subscriber's status, rather than flash the wrong screen.
  if ((signedIn && setup.loading) || (personalized && !subscription.access && subscription.checking))
    return (
      <View
        accessible
        accessibilityLabel="Loading Votic"
        style={[s.loading, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  const slide = { animation: reduceMotion ? ("none" as const) : ("slide_from_right" as const) };
  const fade = { animation: reduceMotion ? ("none" as const) : ("fade" as const) };
  return (
    <DocumentLibraryProvider>
      <DocumentTransitionProvider>
        <WalkthroughProvider>
          {/* Welcome through "Votic is ready for you" use a lighter orange; Votic itself keeps the chosen accent. */}
          <SetupAccent active={!(subscribed && setup.handedOff)}>
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
                <Stack.Screen name="create-account" options={slide} />
                <Stack.Screen name="sign-in" options={slide} />
                <Stack.Screen name="forgot-password" options={slide} />
              </Stack.Protected>
              <Stack.Protected guard={signedIn && !personalized}>
                <Stack.Screen name="personalize" options={fade} />
              </Stack.Protected>
              <Stack.Protected guard={personalized && !subscribed}>
                <Stack.Screen name="paywall" options={fade} />
              </Stack.Protected>
              <Stack.Protected guard={subscribed && !setup.handedOff}>
                <Stack.Screen name="ready" options={fade} />
              </Stack.Protected>
              <Stack.Protected guard={subscribed && setup.handedOff}>
                <Stack.Screen name="(tabs)" options={fade} />
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
                <Stack.Screen name="statistics" options={slide} />
              </Stack.Protected>
            </Stack>
          </SetupAccent>
        </WalkthroughProvider>
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
              <SubscriptionProvider>
                <AccountSetupProvider>
                  <ActivityProvider>
                    <ThemedStack />
                  </ActivityProvider>
                </AccountSetupProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </PurposeProvider>
        </AccessibilityProvider>
      </ThemeProvider>
    </OnboardingProvider>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
