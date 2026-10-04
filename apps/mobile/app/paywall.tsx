import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../src/components/VoticLogo";
import { radii, spacing, typography } from "../src/design/tokens";
import { PrimaryButton, TextButton } from "../src/onboarding/components";
import { useVoticTheme } from "../src/theme/ThemeProvider";
const PLANS = {
  annual: {
    title: "Annual",
    price: "$99",
    period: "/ year",
    detail: "$8.25/month, 36% discount",
    renewal: "$99 per year",
  },
  monthly: {
    title: "Monthly",
    price: "$12.99",
    period: "/ month",
    detail: "Billed monthly",
    renewal: "$12.99 per month",
  },
} as const;
const BENEFITS = [
  ["Read your way", "Adjust text, spacing, and page colors."],
  ["Listen and follow along", "Hear your documents and resume where you left off."],
  ["Ask Votic", "Get summaries, explanations, and answers about your documents."],
  ["Scan printed pages", "Turn photos of text into documents you can read or listen to."],
  ["Keep what matters", "Save notes and organize documents into collections."],
];
export default function Paywall() {
  const { theme } = useVoticTheme();
  const [selected, setSelected] = useState<keyof typeof PLANS>("annual");
  const plan = PLANS[selected];
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={[s.hero, { backgroundColor: theme.surfaceMuted }]}>
          <View pointerEvents="none" style={[s.glow, { backgroundColor: theme.accent }]} />
          <VoticLogo />
          <Text style={[s.eyebrow, { color: theme.accent }]}>VOTIC MEMBERSHIP</Text>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            {"Your documents.\nMore possibilities."}
          </Text>
          <Text style={[s.subtitle, { color: theme.mutedText }]}>
            Read, listen, and understand—with support that fits you.
          </Text>
          <View style={[s.trial, { backgroundColor: theme.surface }]}>
            <Ionicons name="gift-outline" size={20} color={theme.accent} />
            <Text style={[s.trialText, { color: theme.text }]}>Two-week free trial at launch</Text>
          </View>
        </View>
        <View style={[s.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={[s.tableHeader, { borderBottomColor: theme.border }]}>
            <Text accessibilityRole="header" style={[s.sectionTitle, { color: theme.text }]}>
              Everything in one plan
            </Text>
            <Text style={[s.included, { color: theme.accent }]}>Included</Text>
          </View>
          {BENEFITS.map(([title, detail]) => (
            <View
              key={title}
              accessible
              accessibilityLabel={`${title}. ${detail} Included.`}
              style={[s.row, { borderBottomColor: theme.border }]}
            >
              <View style={s.benefitCopy}>
                <Text style={[s.benefitTitle, { color: theme.text }]}>{title}</Text>
                <Text style={[s.detail, { color: theme.mutedText }]}>{detail}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={23} color={theme.accent} />
            </View>
          ))}
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel="Billing plan" style={s.plans}>
          {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((key) => {
            const item = PLANS[key],
              active = selected === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={`${item.title}, ${item.renewal}${key === "annual" ? ", save 36 percent" : ""}`}
                accessibilityState={{ checked: active }}
                onPress={() => setSelected(key)}
                style={[
                  s.plan,
                  {
                    backgroundColor: active ? theme.sentenceHighlight : theme.surface,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              >
                <View style={s.planTop}>
                  <Text style={[s.benefitTitle, { color: theme.text }]}>{item.title}</Text>
                  {key === "annual" ? <Text style={[s.badge, { color: theme.accent }]}>SAVE 36%</Text> : null}
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={22}
                    color={active ? theme.accent : theme.mutedText}
                  />
                </View>
                <Text style={[s.price, { color: theme.text }]}>
                  {item.price}
                  <Text style={[s.period, { color: theme.mutedText }]}> {item.period}</Text>
                </Text>
                <Text style={[s.detail, { color: theme.mutedText }]}>{item.detail}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text accessibilityLiveRegion="polite" style={[s.renewal, { color: theme.mutedText }]}>
          At launch: 14 days free, then {plan.renewal}. Renews automatically unless canceled before the trial
          or billing period ends.
        </Text>
      </ScrollView>
      <View style={[s.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <Text style={[s.beta, { color: theme.mutedText }]}>
          Votic is free during beta. Continuing won’t charge you or start a trial.
        </Text>
        <PrimaryButton label="Continue" onPress={() => router.replace("/")} />
        <TextButton
          label="Restore purchases"
          onPress={() =>
            Alert.alert(
              "Restore purchases",
              "Subscriptions aren’t available during beta. No purchases can be restored yet.",
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
  hero: { borderRadius: radii.sheet, padding: spacing.lg, gap: spacing.md, overflow: "hidden" },
  glow: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    opacity: 0.13,
    right: -72,
    top: -78,
  },
  eyebrow: { ...typography.eyebrow },
  title: { ...typography.screenTitle, fontSize: 34, lineHeight: 39, letterSpacing: -0.8 },
  subtitle: { fontSize: 16, lineHeight: 23, fontWeight: "600" },
  trial: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  trialText: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  card: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.md },
  tableHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", flexShrink: 1 },
  included: { fontSize: 12, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  benefitCopy: { flex: 1, gap: spacing.xs },
  benefitTitle: { fontSize: 16, fontWeight: "700" },
  detail: { fontSize: 14, lineHeight: 20 },
  plans: { gap: spacing.sm },
  plan: { borderWidth: 2, borderRadius: radii.lg, padding: spacing.md, gap: spacing.xs },
  planTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  badge: { fontSize: 12, fontWeight: "800" },
  price: { fontSize: 28, fontWeight: "800" },
  period: { fontSize: 15, fontWeight: "500" },
  renewal: { fontSize: 12, lineHeight: 18 },
  footer: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1 },
  beta: { fontSize: 12, lineHeight: 18, textAlign: "center" },
});
