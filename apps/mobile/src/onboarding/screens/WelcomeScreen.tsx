import { StyleSheet, Text, View } from "react-native";
import { ACCOUNTS_UNAVAILABLE_MESSAGE } from "../../auth/authTypes";
import { spacing, typography } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { useAccount } from "../AccountProvider";
import { Notice, OnboardingScreen, PrimaryButton, SecondaryButton } from "../components/OnboardingUI";

/**
 * The first screen for someone who isn't signed in. Only sign-in methods that work are shown; Google and
 * Apple buttons will be added here when those providers are configured (apps/mobile/docs/ACCOUNTS_AND_SUBSCRIPTIONS.md).
 */
export function WelcomeScreen({
  onCreateAccount,
  onSignIn,
}: {
  onCreateAccount: () => void;
  onSignIn: () => void;
}) {
  const { theme } = useVoticTheme();
  const { services, setDevelopmentBypass, isDevelopment } = useAccount();
  const available = services.auth.available;
  return (
    <OnboardingScreen
      footer={
        available ? (
          <>
            <PrimaryButton label="Create Account" onPress={onCreateAccount} />
            <SecondaryButton label="Sign In" onPress={onSignIn} />
          </>
        ) : isDevelopment ? (
          <SecondaryButton
            label="Continue without an account (development build)"
            onPress={() => setDevelopmentBypass({ account: true })}
          />
        ) : undefined
      }
    >
      <View style={s.hero}>
        <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
          Welcome to Votic
        </Text>
        <Text style={[s.body, { color: theme.mutedText }]}>
          Read, listen, and understand your documents — with help whenever you want it.
        </Text>
      </View>
      {!available ? <Notice>{ACCOUNTS_UNAVAILABLE_MESSAGE}</Notice> : null}
    </OnboardingScreen>
  );
}

const s = StyleSheet.create({
  hero: { flexGrow: 1, justifyContent: "center", gap: spacing.md, paddingVertical: spacing.section },
  title: { ...typography.screenTitle, fontSize: 34 },
  body: { ...typography.body, fontSize: 19, lineHeight: 29 },
});
