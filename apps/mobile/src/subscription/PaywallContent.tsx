import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { VoticLogo } from "../components/VoticLogo";
import { PaywallRobot } from "./PaywallRobot";
import { useVoticTheme } from "../theme/ThemeProvider";
import { paywallStyles as p } from "./paywallStyles";

/** The logo, headline and supporting copy at the top of the paywall. */
export function PaywallIntro() {
  const { theme } = useVoticTheme();
  const { width, fontScale } = useWindowDimensions();
  return (
    <View style={[s.hero, { backgroundColor: theme.background }]}>
      <View style={s.brand}>
        <VoticLogo animate={false} />
      </View>
      <PaywallRobot />
      <View style={s.copy}>
        <Text
          accessibilityRole="header"
          style={[
            s.title,
            { color: theme.isDark ? theme.text : "#09133D" },
            width < 360 && { fontSize: fontScale >= 1.6 ? 21 : 23, lineHeight: fontScale >= 1.6 ? 26 : 28 },
          ]}
        >
          Read, listen, and understand more
        </Text>
        <Text style={[s.supporting, { color: theme.isDark ? theme.mutedText : "#435580" }]}>
          Make more of every document with Votic Plus
        </Text>
      </View>
    </View>
  );
}

/**
 * What Plus adds over Free. Every number is an enforced limit: Free's 5 documents and 25 notes/bookmarks
 * (DocumentLibraryProvider), 2,000 documents (documentStorage's MAX_STORED_DOCUMENTS), and Free's 75 monthly
 * AI credits, 5 summaries and 3 camera-scan pages (server ai_credits / votic_server). Plus AI use is a larger
 * monthly credit allowance, never unlimited; scanned-PDF reading is Plus only.
 */
export function PaywallBenefits() {
  const { theme } = useVoticTheme();
  const { fontScale } = useWindowDimensions();
  const rows = [
    {
      icon: "layers-outline",
      title: "More room for your library",
      detail: "Up to 2,000 documents (Free: 5)",
    },
    {
      icon: "chatbubble-ellipses-outline",
      title: "More AI questions & summaries",
      detail: "More monthly AI credits than Free's 75",
    },
    {
      icon: "scan-outline",
      title: "Scan more pages and PDFs",
      detail: "Free scans 3 camera pages a month",
    },
    {
      icon: "bookmark-outline",
      title: "Unlimited notes and bookmarks",
      detail: "Free includes 25 in total",
    },
  ] as const;
  return (
    <View accessibilityLabel="Included with Votic Plus" style={s.benefits}>
      {rows.map(({ icon, title, detail }) => (
        <View
          key={title}
          accessible
          accessibilityLabel={`${title}. ${detail}`}
          style={[
            s.feature,
            fontScale >= 1.6 && s.featureLargeText,
            {
              borderColor: theme.isDark ? theme.border : "#CCE0FF",
              backgroundColor: theme.surface,
            },
          ]}
        >
          <View
            accessible={false}
            style={[s.icon, { backgroundColor: theme.isDark ? theme.brandTint : "#E9F5FF" }]}
          >
            <Ionicons name={icon} size={24} color={theme.isDark ? theme.accentText : "#0061FF"} />
            {icon === "scan-outline" ? (
              <View style={s.scanDocument}>
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color={theme.isDark ? theme.accentText : "#0061FF"}
                />
              </View>
            ) : null}
          </View>
          <View style={[s.benefitCopy, fontScale >= 1.6 && s.largeCopy]}>
            <Text style={[s.featureTitle, { color: theme.isDark ? theme.text : "#09133D" }]}>{title}</Text>
            <Text style={[s.featureDetail, { color: theme.isDark ? theme.mutedText : "#435580" }]}>
              {detail}
            </Text>
          </View>
        </View>
      ))}
      <View style={s.creditNote}>
        <Ionicons name="information-circle-outline" size={16} color={theme.mutedText} />
        <Text style={[s.creditCopy, { color: theme.mutedText }]}>
          AI features use your monthly Plus credits.
        </Text>
      </View>
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
        accessibilityLabel="Questions about plans"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={p.disclosure}
      >
        <Text style={[p.benefitTitle, { color: theme.text }]}>Questions about plans</Text>
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
            Votic Free includes 75 AI credits a month for questions, with up to 5 summaries and 3 camera-scan
            pages. Votic Plus includes a larger monthly allowance for AI answers, summaries, voice questions,
            and reading scanned pages. Allowances renew monthly and unused usage doesn&apos;t carry over.
            Reading, listening, and notes don&apos;t use it. See what&apos;s left anytime in Settings, AI
            Credits &amp; Usage.
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
  hero: { alignItems: "center", gap: 4 },
  brand: { alignItems: "center", justifyContent: "center", minHeight: 36 },
  copy: { gap: 4, alignSelf: "stretch" },
  title: { fontWeight: "800", fontSize: 24, lineHeight: 29, letterSpacing: -0.5, textAlign: "center" },
  supporting: { fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  benefits: { gap: 6 },
  feature: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureLargeText: { flexDirection: "column", alignItems: "flex-start" },
  featureTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
  featureDetail: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  icon: { width: 40, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  benefitCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: 1 },
  largeCopy: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", alignSelf: "stretch" },
  scanDocument: { position: "absolute", alignItems: "center", justifyContent: "center" },
  creditNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 2 },
  creditCopy: { flexShrink: 1, fontSize: 12, lineHeight: 17 },
  helpCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16 },
  help: { gap: 10, paddingBottom: 16 },
});
