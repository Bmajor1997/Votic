import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { useAccount } from "../AccountProvider";
import { OnboardingScreen, PrimaryButton } from "../components/OnboardingUI";

/** Shown once, after the store confirms a trial or subscription. No walkthrough follows. */
export function ReadyScreen() {
  const { theme } = useVoticTheme();
  const { user, completeOnboarding } = useAccount();
  return (
    <OnboardingScreen footer={<PrimaryButton label="Start Using Votic" onPress={completeOnboarding} />}>
      <View style={s.center}>
        <View style={[s.badge, { backgroundColor: theme.sentenceHighlight }]}>
          <Ionicons name="checkmark" size={40} color={theme.accent} />
        </View>
        <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
          {user?.firstName ? `Votic is ready for you, ${user.firstName}.` : "Votic is ready for you."}
        </Text>
        <Text style={[s.body, { color: theme.mutedText }]}>
          {"Your preferences are saved. You can change them anytime in Settings."}
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const s = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.section,
  },
  badge: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  title: { ...typography.screenTitle, fontSize: 28, textAlign: "center" },
  body: { ...typography.body, textAlign: "center" },
});
