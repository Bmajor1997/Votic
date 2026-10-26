import { editorial } from "../src/design/editorial";
import { useEffect } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../src/components/VoticLogo";
import { spacing } from "../src/design/tokens";
import { useAccountSetup } from "../src/onboarding/AccountSetupProvider";
import { PersonalizationRecap } from "../src/onboarding/PersonalizationRecap";
import { PrimaryButton } from "../src/onboarding/components";
import { useSubscription } from "../src/subscription/SubscriptionProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";

/** Final value recap before the paywall; subscribers continue directly to Home. */
export default function Ready() {
  const { theme } = useVoticTheme();
  const { completeHandoff } = useAccountSetup();
  const { access } = useSubscription();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.("Votic is ready for you.");
  }, []);
  return (
    <SafeAreaView style={[s.fill, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.brand}>
          <VoticLogo />
        </View>
        <View style={s.copy}>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            Votic is ready for you
          </Text>
          <Text style={[s.subtitle, { color: theme.mutedText }]}>
            {access
              ? "Start with a document you want to get through."
              : "Your preferences are saved. Next, choose your Votic Premium plan."}
          </Text>
        </View>
        <PersonalizationRecap />
      </ScrollView>
      <View style={[s.footer, { borderTopColor: theme.border }]}>
        <PrimaryButton
          label={access ? "Start using Votic" : "See Votic Premium plans"}
          onPress={completeHandoff}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  brand: { minHeight: 58, justifyContent: "center" },
  copy: { gap: spacing.sm, marginTop: spacing.xl },
  title: { ...editorial, fontSize: 36, lineHeight: 44 },
  subtitle: { fontSize: 17, lineHeight: 25 },
  footer: { borderTopWidth: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.xs },
});
