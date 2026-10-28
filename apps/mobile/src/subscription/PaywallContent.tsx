import { editorial } from "../design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { VoticLogo } from "../components/VoticLogo";
import { useVoticTheme } from "../theme/ThemeProvider";
import { paywallStyles as p } from "./paywallStyles";

/**
 * The six Votic Plus benefits. Each one describes something Votic does today; the AI allowance is described as
 * generous monthly usage rather than a number of credits.
 */
export const PLUS_BENEFITS: { title: string; detail: string }[] = [
  {
    title: "Read and listen to your documents",
    detail: "Natural voices at your pace, with each word highlighted as it's read.",
  },
  {
    title: "Ask AI about your documents",
    detail: "Get answers grounded in what you're reading, typed or spoken.",
  },
  {
    title: "AI-powered summaries",
    detail: "Summarize your documents or an Ask Votic conversation.",
  },
  {
    title: "Save notes and bookmarks",
    detail: "Bookmark passages and add your own notes as you read.",
  },
  {
    title: "Import almost anything",
    detail: "PDFs, ebooks, Word files, webpages, and scanned documents.",
  },
  {
    title: "Generous monthly AI usage",
    detail: "Renews with your subscription every month.",
  },
];

/** The logo, headline and supporting copy at the top of the paywall. */
export function PaywallIntro() {
  const { theme } = useVoticTheme();
  const { width } = useWindowDimensions();
  return (
    <View style={[s.hero, { backgroundColor: theme.background }]}>
      <View style={s.brand}>
        <VoticLogo />
        <Text style={[p.eyebrow, { color: theme.accentText }]}>VOTIC PLUS</Text>
      </View>
      <View style={s.copy}>
        <Text
          accessibilityRole="header"
          style={[s.title, { color: theme.text }, width < 360 && { fontSize: 22, lineHeight: 28 }]}
        >
          Make more of every document.
        </Text>
        <Text style={[s.supporting, { color: theme.text }]}>Your AI-powered reading companion.</Text>
      </View>
    </View>
  );
}

/** All six Votic Plus benefits. */
export function PaywallBenefits() {
  const { theme } = useVoticTheme();
  return (
    <View accessibilityLabel="Included with Votic Plus" style={s.card}>
      <Text accessibilityRole="header" style={[p.sectionTitle, s.cardTitle, { color: theme.text }]}>
        Included with Votic Plus
      </Text>
      {PLUS_BENEFITS.map((benefit) => (
        <View key={benefit.title} style={s.row}>
          <View
            accessible
            accessibilityLabel={`${benefit.title}. ${benefit.detail} Included.`}
            style={s.benefitRow}
          >
            <Ionicons
              testID="benefit-check"
              name="checkmark-circle"
              size={24}
              color={theme.accentText}
              style={s.check}
            />
            <View style={s.benefitCopy}>
              <Text style={[p.benefitTitle, { color: theme.text }]}>{benefit.title}</Text>
              <Text style={[p.detail, { color: theme.mutedText }]}>{benefit.detail}</Text>
            </View>
          </View>
        </View>
      ))}
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
          <Text style={[p.benefitTitle, { color: theme.text }]}>How does AI usage work?</Text>
          <Text style={[p.detail, { color: theme.mutedText }]}>
            Votic Plus includes a generous monthly allowance for AI answers, summaries, voice questions, and
            reading scanned pages. It renews with your subscription and unused usage doesn&apos;t carry over.
            Reading, listening, and notes don&apos;t use it. See what&apos;s left anytime in Settings, AI
            Usage.
          </Text>
          <Text style={[p.benefitTitle, { color: theme.text }]}>Which voices can I use?</Text>
          <Text style={[p.detail, { color: theme.mutedText }]}>
            Choose from the voices available on your device. Voice availability and sound can vary by device.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 28, padding: 8, gap: 14 },
  brand: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  copy: { gap: 10 },
  title: { ...editorial, fontSize: 24, lineHeight: 30 },
  supporting: { fontSize: 16, lineHeight: 23, fontWeight: "700" },
  subtitle: { fontSize: 16, lineHeight: 24 },
  card: { width: "100%", maxWidth: 420, alignSelf: "center" },
  cardTitle: { paddingTop: 12, paddingBottom: 8, textAlign: "center" },
  row: { paddingVertical: 8 },
  // The check sits beside the benefit's title, even when its description wraps.
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  check: { marginTop: -1 },
  benefitCopy: { flex: 1, gap: 4 },
  helpCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16 },
  help: { gap: 10, paddingBottom: 16 },
});
