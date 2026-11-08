import { editorial } from "../design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { VoticLogo } from "../components/VoticLogo";
import { BrandMark } from "../onboarding/WelcomeMotion";
import { useVoticTheme } from "../theme/ThemeProvider";
import { paywallStyles as p } from "./paywallStyles";

/** The logo, headline and supporting copy at the top of the paywall. */
export function PaywallIntro() {
  const { theme } = useVoticTheme();
  const { width } = useWindowDimensions();
  return (
    <View style={[s.hero, { backgroundColor: theme.background }]}>
      <View style={s.brand}>
        <VoticLogo animate={false} />
        <Text style={[p.eyebrow, { color: theme.accentText }]}>VOTIC PLUS</Text>
      </View>
      <View style={s.copy}>
        <Text
          accessibilityRole="header"
          style={[s.title, { color: theme.text }, width < 360 && { fontSize: 22, lineHeight: 28 }]}
        >
          Find your reading rhythm
        </Text>
        <Text style={[s.supporting, { color: theme.text }]}>Choose the plan that fits you.</Text>
      </View>
      <View testID="paywall-brand-mark" style={s.art}>
        <BrandMark size={width < 360 ? 88 : 112} arrive />
      </View>
    </View>
  );
}

/** Votic Free next to Votic Plus, row by row. The limits match the ones the app and server enforce. */
export function PaywallBenefits() {
  const { theme } = useVoticTheme();
  const rows = [
    ["Read and listen", "✓ No time limit", "✓ No time limit"],
    ["Saved documents", "✓ Up to 5", "✓ Up to 2,000"],
    ["Notes and bookmarks", "✓ Up to 25 combined", "✓ No set limit"],
    ["AI credits", "✓ 100 per month", "✓ Larger monthly allowance"],
    ["AI questions", "✓ Uses your 100 credits", "✓ Uses Plus allowance"],
    ["AI summaries", "✓ 5 per month; uses credits", "✓ Uses Plus allowance"],
    ["Camera scans", "✓ 5 pages per month; uses credits", "✓ Uses Plus allowance"],
    ["Scanned PDF reading", "− Plus feature", "✓ Uses Plus allowance"],
    ["No ads", "✓ Included", "✓ Included"],
  ];
  return (
    <View
      accessibilityLabel="Compare Votic Free and Votic Plus"
      style={[s.card, { borderColor: theme.border, backgroundColor: theme.surface }]}
    >
      <Text accessibilityRole="header" style={[p.sectionTitle, s.cardTitle, { color: theme.text }]}>
        Compare Free and Plus
      </Text>
      <View style={s.comparisonRow}>
        <Text style={s.labelColumn} />
        <Text style={[s.valueColumn, s.columnHeading, { color: theme.text }]}>Free</Text>
        <Text
          style={[
            s.valueColumn,
            s.columnHeading,
            { color: theme.accentText, backgroundColor: theme.brandTint },
          ]}
        >
          Plus
        </Text>
      </View>
      {rows.map(([label, free, plus]) => (
        <View
          key={label}
          accessible
          accessibilityLabel={`${label}. Free: ${free}. Plus: ${plus}.`}
          style={[s.comparisonRow, { borderTopColor: theme.border, borderTopWidth: 1 }]}
        >
          <Text style={[p.benefitTitle, s.labelColumn, { color: theme.text }]}>{label}</Text>
          <Text style={[p.detail, s.valueColumn, { color: theme.text }]}>{free}</Text>
          <Text
            style={[p.detail, s.valueColumn, { color: theme.accentText, backgroundColor: theme.brandTint }]}
          >
            {plus}
          </Text>
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
            Votic Free includes 100 AI credits a month for questions, with up to 5 summaries and 5 camera-scan
            pages. Votic Plus includes a larger monthly allowance for AI answers, summaries, voice questions,
            and reading scanned pages. Allowances renew monthly and unused usage doesn&apos;t carry over.
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
  art: { alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 16, lineHeight: 24 },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  cardTitle: { paddingTop: 12, paddingBottom: 8, textAlign: "center" },
  comparisonRow: { flexDirection: "row", alignItems: "stretch" },
  labelColumn: { flex: 1.5, padding: 8 },
  valueColumn: { flex: 1, padding: 8, textAlign: "center", textAlignVertical: "center" },
  columnHeading: { fontWeight: "800" },
  row: { paddingVertical: 8 },
  // The check sits beside the benefit's title, even when its description wraps.
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  check: { marginTop: -1 },
  benefitCopy: { flex: 1, gap: 4 },
  helpCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16 },
  help: { gap: 10, paddingBottom: 16 },
});
