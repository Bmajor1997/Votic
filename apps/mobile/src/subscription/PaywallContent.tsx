import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { VoticLogo } from "../components/VoticLogo";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { PAYWALL_GOALS } from "./paywallPresentation";

export function PaywallIntro() {
  const { theme } = useVoticTheme();
  const { purpose } = useVoticPurpose();
  const { width } = useWindowDimensions();
  const goal = PAYWALL_GOALS[purpose ?? "default"];
  return (
    <>
      <View style={[s.hero, { backgroundColor: theme.hero }]}>
        <View style={s.brand}>
          <VoticLogo />
          <Text style={[s.eyebrow, { color: theme.accentText }]}>VOTIC PREMIUM</Text>
        </View>
        <Text style={[s.eyebrow, { color: theme.heroMuted }]}>01 / WHAT OPENS UP</Text>
        <Text
          accessibilityRole="header"
          style={[s.title, { color: theme.heroText }, width < 360 && { fontSize: 30, lineHeight: 36 }]}
        >
          {goal.title}
        </Text>
        <Text style={[s.subtitle, { color: theme.heroMuted }]}>{goal.detail}</Text>
      </View>
      <View style={s.heading}>
        <Text style={[s.eyebrow, { color: theme.accentText }]}>02 / FEEL THE DIFFERENCE</Text>
        <Text accessibilityRole="header" style={[s.sectionTitle, { color: theme.text }]}>
          Your page. Brought to life.
        </Text>
      </View>
    </>
  );
}

export function PaywallStart({ store }: { store: "App Store" | "Google Play" }) {
  const { theme } = useVoticTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <View style={[s.hero, { backgroundColor: theme.hero }]}>
        <Text style={[s.eyebrow, { color: theme.accentText }]}>04 / MAKE IT YOURS</Text>
        <Text accessibilityRole="header" style={[s.sectionTitle, { color: theme.heroText }]}>
          Start with one document.
        </Text>
        <Text style={[s.detail, { color: theme.heroMuted }]}>
          Choose a plan, then start below. Once your subscription is confirmed, Votic will guide you into your
          library. Import a document, choose a voice, and press play.
        </Text>
        <View style={s.trust}>
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.accentText} />
          <Text style={[s.detail, { color: theme.heroMuted }]}>
            Payment handled by {store}. Cancel in your store settings.
          </Text>
        </View>
      </View>
      <View style={[s.helpCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Subscription questions"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={s.disclosure}
        >
          <Text style={[s.benefitTitle, { color: theme.text }]}>A few things you might be wondering</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={theme.accentText} />
        </Pressable>
        {expanded ? (
          <View style={s.help}>
            <Text style={[s.benefitTitle, { color: theme.text }]}>How do I cancel?</Text>
            <Text style={[s.detail, { color: theme.mutedText }]}>
              Manage or cancel through your {store} subscription settings. Cancel before the renewal deadline
              shown below to avoid the next charge.
            </Text>
            <Text style={[s.benefitTitle, { color: theme.text }]}>Already subscribed?</Text>
            <Text style={[s.detail, { color: theme.mutedText }]}>
              Sign in to the Votic account you used before, then tap Restore Purchases with the same store
              account.
            </Text>
            <Text style={[s.benefitTitle, { color: theme.text }]}>
              Is this what my documents will sound like?
            </Text>
            <Text style={[s.detail, { color: theme.mutedText }]}>
              The preview uses a voice available on this device. Voice availability and sound can vary by
              device. AI features have usage allowances.
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 28, padding: 20, gap: 12 },
  brand: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, lineHeight: 17 },
  title: { fontSize: 36, lineHeight: 42, fontWeight: "800", letterSpacing: -1.2 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  heading: { gap: 7, marginTop: 8 },
  sectionTitle: { fontSize: 21, fontWeight: "800", letterSpacing: -0.3 },
  detail: { fontSize: 14, lineHeight: 22, flexShrink: 1 },
  trust: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  helpCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16 },
  disclosure: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  benefitTitle: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  help: { gap: 10, paddingBottom: 16 },
});
