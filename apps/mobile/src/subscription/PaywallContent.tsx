import { editorial } from "../design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { PaperArtwork } from "../components/PaperArtwork";
import { VoticLogo } from "../components/VoticLogo";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { PAYWALL_GOALS } from "./paywallPresentation";
import { paywallStyles as p } from "./paywallStyles";

/** The headline, worded from what the visitor said Votic should help with. */
export function PaywallIntro() {
  const { theme } = useVoticTheme();
  const { purpose } = useVoticPurpose();
  const { width } = useWindowDimensions();
  const goal = PAYWALL_GOALS[purpose ?? "default"];
  return (
    <View style={[s.hero, { backgroundColor: theme.background }]}>
      <View style={s.brand}>
        <VoticLogo />
        <Text style={[p.eyebrow, { color: theme.accentText }]}>VOTIC PREMIUM</Text>
      </View>
      <Text
        accessibilityRole="header"
        style={[s.title, { color: theme.text }, width < 360 && { fontSize: 30, lineHeight: 36 }]}
      >
        {goal.title}
      </Text>
      <PaperArtwork compact />
      <Text style={[s.subtitle, { color: theme.mutedText }]}>{goal.detail}</Text>
      <View style={s.benefits}>
        {[
          { icon: "headset-outline" as const, label: "Read & listen" },
          { icon: "sparkles-outline" as const, label: "Ask your documents" },
          { icon: "bookmark-outline" as const, label: "Keep your ideas" },
        ].map((benefit) => (
          <View key={benefit.label} style={s.benefit}>
            <Ionicons name={benefit.icon} size={17} color={theme.accentText} />
            <Text style={[s.benefitLabel, { color: theme.text }]}>{benefit.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.accessNote, { color: theme.text }]}>
        A subscription is required for your documents. Try the sample preview for free.
      </Text>
    </View>
  );
}

/** Answers to the usual questions, closed until asked for so the offer stays short. */
export function PaywallQuestions({ store }: { store: "App Store" | "Google Play" }) {
  const { theme } = useVoticTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[s.helpCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Subscription questions"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={p.disclosure}
      >
        <Text style={[p.benefitTitle, { color: theme.text }]}>Questions about subscribing</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={theme.accentText} />
      </Pressable>
      {expanded ? (
        <View style={s.help}>
          <Text style={[p.benefitTitle, { color: theme.text }]}>How do I cancel?</Text>
          <Text style={[p.detail, { color: theme.mutedText }]}>
            Payment is handled by {store}. Manage or cancel in your {store} subscription settings before the
            next renewal to avoid another charge.
          </Text>
          <Text style={[p.benefitTitle, { color: theme.text }]}>Already subscribed?</Text>
          <Text style={[p.detail, { color: theme.mutedText }]}>
            Sign in to the Votic account you used before, then tap Restore Purchases with the same store
            account.
          </Text>
          <Text style={[p.benefitTitle, { color: theme.text }]}>
            Is this what my documents will sound like?
          </Text>
          <Text style={[p.detail, { color: theme.mutedText }]}>
            The preview uses a voice available on this device. Voice availability and sound can vary by
            device. AI features have usage allowances.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 28, padding: 8, gap: 14 },
  benefits: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginVertical: 4 },
  benefit: { flexDirection: "row", alignItems: "center", gap: 6 },
  benefitLabel: { fontSize: 14, lineHeight: 20, fontWeight: "600", flexShrink: 1 },
  brand: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  title: { ...editorial, fontSize: 38, lineHeight: 44 },
  accessNote: { fontSize: 14, lineHeight: 21 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  helpCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16 },
  help: { gap: 10, paddingBottom: 16 },
});
