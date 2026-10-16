import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../src/components/VoticLogo";
import { radii, spacing, typography } from "../src/design/tokens";
import { useAccountSetup } from "../src/onboarding/AccountSetupProvider";
import { PrimaryButton } from "../src/onboarding/components";
import { useVoticTheme } from "../src/theme/ThemeProvider";

const STEPS: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; detail: string }[] = [
  { icon: "add-circle-outline", title: "Add", detail: "A PDF, Word, PowerPoint, EPUB, or text file." },
  { icon: "headset-outline", title: "Read or listen", detail: "Follow along as Votic reads it aloud." },
  { icon: "chatbubble-ellipses-outline", title: "Ask Votic", detail: "Ask about anything in it." },
];

/** The calm end of setup: one clear next step, and a way to look around first. */
export default function Ready() {
  const { theme } = useVoticTheme();
  const { completeHandoff } = useAccountSetup();
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
            Start with a document you want to get through.
          </Text>
        </View>
        <View style={[s.steps, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {STEPS.map((step, index) => (
            <View
              key={step.title}
              accessible
              accessibilityLabel={`Step ${index + 1}: ${step.title}. ${step.detail}`}
              style={s.step}
            >
              <View style={[s.stepIcon, { backgroundColor: theme.sentenceHighlight }]}>
                <Ionicons name={step.icon} size={22} color={theme.accentText} />
              </View>
              <View style={s.stepCopy}>
                <Text style={[s.stepTitle, { color: theme.text }]}>{step.title}</Text>
                <Text style={[s.stepDetail, { color: theme.mutedText }]}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[s.footer, { borderTopColor: theme.border }]}>
        <PrimaryButton label="Start using Votic" onPress={completeHandoff} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.xl },
  brand: { minHeight: 58, justifyContent: "center" },
  copy: { gap: spacing.sm, marginTop: spacing.xl },
  title: { ...typography.screenTitle, lineHeight: 36 },
  subtitle: { fontSize: 17, lineHeight: 25 },
  steps: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.lg },
  step: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  stepCopy: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 17, fontWeight: "800" },
  stepDetail: { fontSize: 15, lineHeight: 21 },
  footer: { borderTopWidth: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.xs },
});
