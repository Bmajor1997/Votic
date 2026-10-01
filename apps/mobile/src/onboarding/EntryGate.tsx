import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, View } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useAccount } from "./AccountProvider";
import { CreateAccountScreen } from "./screens/CreateAccountScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";
import { PaywallScreen } from "./screens/PaywallScreen";
import { PersonalizeScreen } from "./screens/PersonalizeScreen";
import { ReadyScreen } from "./screens/ReadyScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { VerifyEmailScreen } from "./screens/VerifyEmailScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";

type AccountScreen = "welcome" | "create" | "sign-in" | "forgot";

/**
 * Shows Welcome, account, setup, or paywall screens until the person may enter Votic, then renders the app.
 * The app's screens aren't mounted before then, so nothing behind these screens is reachable.
 */
export function EntryGate({ children }: PropsWithChildren) {
  const { theme } = useVoticTheme();
  const { route } = useAccount();
  // Which account screen to open the next time someone is signed out (normally Welcome).
  const [nextAccountScreen, setNextAccountScreen] = useState<AccountScreen>("welcome");
  const resetAccountScreen = useCallback(() => setNextAccountScreen("welcome"), []);

  switch (route) {
    case "loading":
      return (
        <View style={[s.loading, { backgroundColor: theme.background }]}>
          <ActivityIndicator accessibilityLabel="Loading Votic" color={theme.accent} />
        </View>
      );
    case "welcome":
      return <AccountScreens initialScreen={nextAccountScreen} onShown={resetAccountScreen} />;
    case "verify-email":
      return <VerifyEmailScreen onUseDifferentEmail={() => setNextAccountScreen("create")} />;
    case "personalize":
      return <PersonalizeScreen mode="onboarding" />;
    case "paywall":
      return <PaywallScreen />;
    case "ready":
      return <ReadyScreen />;
    case "app":
      return <>{children}</>;
  }
}

/** Welcome, Create Account, Sign In, and Forgot Password. Mounted fresh each time someone is signed out. */
function AccountScreens({ initialScreen, onShown }: { initialScreen: AccountScreen; onShown: () => void }) {
  const [screen, setScreen] = useState<AccountScreen>(initialScreen);
  const [email, setEmail] = useState("");
  useEffect(onShown, [onShown]);

  // Android's back button moves back through the account screens instead of closing Votic.
  useEffect(() => {
    if (screen === "welcome") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setScreen(screen === "forgot" ? "sign-in" : "welcome");
      return true;
    });
    return () => subscription.remove();
  }, [screen]);

  if (screen === "create")
    return <CreateAccountScreen onBack={() => setScreen("welcome")} onSignIn={() => setScreen("sign-in")} />;
  if (screen === "sign-in")
    return (
      <SignInScreen
        initialEmail={email}
        onBack={() => setScreen("welcome")}
        onCreateAccount={() => setScreen("create")}
        onForgotPassword={(value) => {
          setEmail(value);
          setScreen("forgot");
        }}
      />
    );
  if (screen === "forgot")
    return (
      <ForgotPasswordScreen
        initialEmail={email}
        onBack={(value) => {
          setEmail(value);
          setScreen("sign-in");
        }}
      />
    );
  return <WelcomeScreen onCreateAccount={() => setScreen("create")} onSignIn={() => setScreen("sign-in")} />;
}

const s = StyleSheet.create({ loading: { flex: 1, alignItems: "center", justifyContent: "center" } });
