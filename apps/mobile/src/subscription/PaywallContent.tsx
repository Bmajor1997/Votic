import { editorial } from "../design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { PaperArtwork } from "../components/PaperArtwork";
import { VoticLogo } from "../components/VoticLogo";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { Rise } from "../motion/Rise";
import { PAYWALL_GOALS } from "./paywallPresentation";
import { paywallStyles as p } from "./paywallStyles";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/**
 * The six Votic Plus benefits. Each one describes something Votic does today; the AI allowance is described as
 * generous monthly usage rather than a number of credits.
 */
export const PLUS_BENEFITS: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "headset-outline",
    title: "Read and listen to your documents",
    detail: "Natural voices at your pace, with each word highlighted as it's read.",
  },
  {
    icon: "chatbubble-ellipses-outline",
    title: "Ask AI about your documents",
    detail: "Get answers grounded in what you're reading, typed or spoken.",
  },
  {
    icon: "sparkles-outline",
    title: "AI-powered summaries",
    detail: "Catch up on what you've read, or summarize a conversation.",
  },
  {
    icon: "bookmark-outline",
    title: "Save notes and bookmarks",
    detail: "Bookmark passages and add your own notes as you read.",
  },
  {
    icon: "document-text-outline",
    title: "Import almost anything",
    detail: "PDFs, ebooks, Word files, webpages, and scanned documents.",
  },
  {
    icon: "infinite-outline",
    title: "Generous monthly AI usage",
    detail: "Renews with your subscription every month.",
  },
];

/** The hero settles in first; the headline and supporting copy follow it. */
export function PaywallIntro() {
  const { theme } = useVoticTheme();
  const { purpose } = useVoticPurpose();
  const { width } = useWindowDimensions();
  const goal = PAYWALL_GOALS[purpose ?? "default"];
  return (
    <View style={[s.hero, { backgroundColor: theme.background }]}>
      <Rise style={s.brand}>
        <VoticLogo />
        <Text style={[p.eyebrow, { color: theme.accentText }]}>VOTIC PLUS</Text>
      </Rise>
      <Rise scaleFrom={0.96} distance={10}>
        <PaperArtwork compact />
      </Rise>
      <Rise from={120} to={720} style={s.copy}>
        <Text
          accessibilityRole="header"
          style={[s.title, { color: theme.text }, width < 360 && { fontSize: 30, lineHeight: 36 }]}
        >
          Make more of every document.
        </Text>
        <Text style={[s.supporting, { color: theme.text }]}>Your AI-powered reading companion.</Text>
        <Text style={[s.subtitle, { color: theme.mutedText }]}>{goal.detail}</Text>
      </Rise>
    </View>
  );
}

const BENEFITS_START = 260,
  BENEFIT_STAGGER = 60;

/** All six benefits, each settling in shortly after the one before. */
export function PaywallBenefits() {
  const { theme } = useVoticTheme();
  return (
    <View
      accessibilityLabel="Included with Votic Plus"
      style={[s.card, { borderColor: theme.border, backgroundColor: theme.surface }]}
    >
      <Text accessibilityRole="header" style={[p.sectionTitle, s.cardTitle, { color: theme.text }]}>
        Included with Votic Plus
      </Text>
      {PLUS_BENEFITS.map((benefit, index) => (
        <Rise
          key={benefit.title}
          from={BENEFITS_START + index * BENEFIT_STAGGER}
          to={BENEFITS_START + index * BENEFIT_STAGGER + 360}
          distance={8}
          style={[
            s.row,
            index < PLUS_BENEFITS.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View accessible accessibilityLabel={`${benefit.title}. ${benefit.detail}`} style={s.benefitRow}>
            <View style={[s.featureIcon, { backgroundColor: theme.brandTint }]}>
              <Ionicons name={benefit.icon} size={21} color={theme.accentText} />
            </View>
            <View style={s.benefitCopy}>
              <Text style={[p.benefitTitle, { color: theme.text }]}>{benefit.title}</Text>
              <Text style={[p.detail, { color: theme.mutedText }]}>{benefit.detail}</Text>
            </View>
          </View>
        </Rise>
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
          <Text style={[p.benefitTitle, { color: theme.text }]}>
            Is this what my documents will sound like?
          </Text>
          <Text style={[p.detail, { color: theme.mutedText }]}>
            The preview uses a voice available on this device. Voice availability and sound can vary by
            device.
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
  title: { ...editorial, fontSize: 38, lineHeight: 44 },
  supporting: { fontSize: 19, lineHeight: 27, fontWeight: "700" },
  subtitle: { fontSize: 16, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16 },
  cardTitle: { paddingTop: 16, paddingBottom: 4 },
  row: { paddingVertical: 12 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  benefitCopy: { flex: 1, gap: 4 },
  helpCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16 },
  help: { gap: 10, paddingBottom: 16 },
});
