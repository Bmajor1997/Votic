import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../src/components/VoticLogo";
import { spacing, typography } from "../src/design/tokens";
import { LegalLine, NotConfiguredNotice } from "../src/onboarding/accountForms";
import { PrimaryButton, SecondaryButton } from "../src/onboarding/components";
import { ReaderHero } from "../src/onboarding/ReaderHero";
import { useVoticTheme } from "../src/theme/ThemeProvider";

export default function Welcome() {
  const { theme } = useVoticTheme();
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.brand}>
          <VoticLogo />
        </View>
        <View style={s.hero}>
          <ReaderHero />
        </View>
        <View style={s.copy}>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            Make any document easier to read
          </Text>
          <Text style={[s.subtitle, { color: theme.mutedText }]}>
            Listen along, ask questions, and save what matters.
          </Text>
        </View>
        <View style={s.actions}>
          <PrimaryButton label="Get started" onPress={() => router.push("/create-account")} />
          <SecondaryButton label="Sign in" onPress={() => router.push("/sign-in")} />
          <NotConfiguredNotice />
        </View>
        <LegalLine />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.xl },
  brand: { minHeight: 58, justifyContent: "center" },
  hero: { flexGrow: 1, justifyContent: "center" },
  copy: { gap: spacing.sm },
  title: { ...typography.screenTitle, lineHeight: 36 },
  subtitle: { fontSize: 17, lineHeight: 25 },
  actions: { gap: spacing.md },
});
