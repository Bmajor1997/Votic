import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthProvider";
import { VoticLogo } from "../src/components/VoticLogo";
import { controlSizes, radii, spacing, typography } from "../src/design/tokens";
import { FormMessage } from "../src/onboarding/accountForms";
import { PrimaryButton, SecondaryButton } from "../src/onboarding/components";
import { hasAccess } from "../src/subscription/entitlement";
import {
  billingSummary,
  billingTerms,
  offerTitle,
  planName,
  priceLabel,
  primaryActionLabel,
} from "../src/subscription/offerText";
import { useSubscription } from "../src/subscription/SubscriptionProvider";
import { SubscriptionPlan, SubscriptionUnavailableReason } from "../src/subscription/subscriptionTypes";
import { useVoticTheme } from "../src/theme/ThemeProvider";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Benefits backed by the current import, Reader, Ask Votic, Notes, study, and widget workflows. */
export const PREMIUM_FEATURES: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "document-text-outline",
    title: "Bring your documents together",
    detail: "Import PDF, Word, PowerPoint, EPUB, and text files, including from other apps.",
  },
  {
    icon: "scan-outline",
    title: "Web articles and camera scans",
    detail: "Import a webpage by link or scan one or more pages into a readable document.",
  },
  {
    icon: "options-outline",
    title: "Reading that fits you",
    detail:
      "Adjust text size, fonts, spacing, and focus settings, with light, dark, and sepia Reader themes.",
  },
  {
    icon: "headset-outline",
    title: "Listen as it's read aloud",
    detail: "Choose a device voice and speed, follow spoken-text highlights, and customize pronunciations.",
  },
  {
    icon: "chatbubble-ellipses-outline",
    title: "Ask Votic",
    detail:
      "Ask questions about your documents or selected notes. Save answers and Reader conversation summaries to Notes. AI tools need an internet connection.",
  },
  {
    icon: "bookmark-outline",
    title: "Notes linked to the page",
    detail:
      "Save passages, write quick notes, and edit, tag, search, or share notes. Linked passages return you to their source.",
  },
  {
    icon: "sparkles-outline",
    title: "A workspace for every note",
    detail:
      "Read or listen to a note, then ask Votic to summarize, explain, suggest edits, or create study questions.",
  },
  {
    icon: "school-outline",
    title: "Review and check your understanding",
    detail: "Reflect on a document and answer self-check questions based on the passages you've reached.",
  },
  {
    icon: "folder-open-outline",
    title: "An organized library",
    detail: "Keep documents in collections and find them with search, filters, and sorting.",
  },
  {
    icon: "play-forward-outline",
    title: "Pick up where you left off",
    detail:
      "Resume your saved place in each document. Add Continue and This Week Home Screen widgets on iPhone or Android.",
  },
  {
    icon: "stats-chart-outline",
    title: "Reading statistics and weekly recaps",
    detail: "See reading and listening time, document progress, and a recap of your week's activity.",
  },
];

const UNAVAILABLE_MESSAGES: Record<SubscriptionUnavailableReason, string> = {
  "not-configured":
    "Subscriptions aren't set up in this build of Votic yet, so nothing can be purchased here.",
  "expo-go": "Subscriptions can't be purchased in Expo Go. They need a development or store build of Votic.",
  "unsupported-platform": "Votic Premium is available in the Votic app for iPhone and Android.",
};

const STORE = Platform.OS === "ios" ? "App Store" : "Google Play";

function formatLongDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

type Message = { icon?: IconName; text: string };

/**
 * Votic Premium. Nothing on this screen grants access by itself: access starts only when RevenueCat confirms
 * an active entitlement (a free trial counts) from the App Store or Google Play.
 */
export default function Paywall({ now = () => new Date() }: { now?: () => Date }) {
  const { theme } = useVoticTheme();
  const auth = useAuth();
  const subscription = useSubscription();
  const { service, entitlement, legal } = subscription;
  const unavailable = service.unavailableReason;
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const busy = useRef(false);

  // Asks the store for the current offer; "Try again" asks again.
  useEffect(() => {
    if (unavailable) return;
    let current = true;
    service.getPlans().then(
      (found) => {
        if (!current) return;
        setPlans(found);
        setSelectedId((previous) => previous ?? found.find((plan) => plan.trial)?.id ?? found[0]?.id ?? null);
      },
      () => {
        if (!current) return;
        setLoadFailed(true);
        setPlans([]);
      },
    );
    return () => {
      current = false;
    };
  }, [service, unavailable, attempt]);
  function retry() {
    setLoadFailed(false);
    setPlans(null);
    setMessage(null);
    setAttempt((value) => value + 1);
    if (entitlement.status === "unknown") void subscription.refresh();
  }

  // A trial that has already been used is never promised again, whatever the product offers.
  const usedTrial = entitlement.status === "expired";
  const shown = (plans || []).map((plan) => (usedTrial ? { ...plan, trial: null } : plan));
  const selected = shown.find((plan) => plan.id === selectedId) ?? null;
  const working = purchasing || restoring;

  async function purchase() {
    if (!selected || busy.current) return;
    busy.current = true;
    setPurchasing(true);
    setMessage(null);
    try {
      const outcome = await service.purchase(selected.id);
      if (outcome.kind === "purchased") {
        if (hasAccess(outcome.entitlement.status)) subscription.setEntitlement(outcome.entitlement);
        else
          setMessage({
            text: "Your purchase went through, but Votic couldn't confirm it yet. Tap Restore Purchases in a moment.",
          });
      } else if (outcome.kind === "pending")
        setMessage({
          icon: "time-outline",
          text: "Your purchase is waiting for approval, for example from a parent or your bank. Votic opens as soon as it's approved.",
        });
      else if (outcome.kind === "failed") setMessage({ text: outcome.message });
      // Closing the store's purchase sheet needs no message; the offer stays as it was.
    } finally {
      busy.current = false;
      setPurchasing(false);
    }
  }
  async function restore() {
    if (busy.current) return;
    busy.current = true;
    setRestoring(true);
    setMessage(null);
    try {
      const restored = await service.restore();
      if (hasAccess(restored.status)) subscription.setEntitlement(restored);
      else if (restored.status === "unknown")
        setMessage({ text: "Votic couldn't reach the store. Check your connection and try again." });
      else
        setMessage({
          icon: "information-circle-outline",
          text: `No active Votic Premium subscription was found for this ${STORE} account.`,
        });
    } finally {
      busy.current = false;
      setRestoring(false);
    }
  }

  const statusNotice =
    entitlement.status === "expired"
      ? "Your Votic Premium subscription has ended. Subscribe again to keep reading with Votic."
      : entitlement.status === "unknown" && !unavailable && !subscription.checking
        ? "Votic couldn't confirm your subscription. If you already subscribed, tap Restore Purchases."
        : null;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[s.fill, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { backgroundColor: theme.surfaceMuted }]}>
          <View pointerEvents="none" style={[s.glow, { backgroundColor: theme.accent }]} />
          <VoticLogo />
          <Text style={[s.eyebrow, { color: theme.accentText }]}>VOTIC MEMBERSHIP</Text>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            {"Your documents.\nMore possibilities."}
          </Text>
          <Text style={[s.subtitle, { color: theme.mutedText }]}>
            Read, listen, and understand—with support that fits you.
          </Text>
          {/* Worded from the store's offer, so a trial is promised only when the plan really has one. */}
          {!unavailable && selected?.trial ? (
            <View style={[s.trial, { backgroundColor: theme.surface }]}>
              <Ionicons name="gift-outline" size={20} color={theme.accentText} />
              <Text style={[s.trialText, { color: theme.text }]}>{offerTitle(selected)}</Text>
            </View>
          ) : null}
        </View>

        <View
          accessibilityLabel="Included with Votic Premium"
          style={[s.card, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <View style={[s.tableHeader, { borderBottomColor: theme.border }]}>
            <Text accessibilityRole="header" style={[s.sectionTitle, { color: theme.text }]}>
              Everything in one plan
            </Text>
            <Text style={[s.included, { color: theme.accentText }]}>Included</Text>
          </View>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View
              key={feature.title}
              accessible
              accessibilityLabel={`${feature.title}. ${feature.detail} Included.`}
              style={[
                s.row,
                index < PREMIUM_FEATURES.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <View style={s.benefitCopy}>
                <Text style={[s.benefitTitle, { color: theme.text }]}>{feature.title}</Text>
                <Text style={[s.detail, { color: theme.mutedText }]}>{feature.detail}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={23} color={theme.accentText} />
            </View>
          ))}
        </View>

        {unavailable ? (
          <FormMessage icon="information-circle-outline" text={UNAVAILABLE_MESSAGES[unavailable]} />
        ) : null}
        {statusNotice ? <FormMessage icon="information-circle-outline" text={statusNotice} /> : null}

        {shown.length > 1 ? (
          <View accessibilityRole="radiogroup" accessibilityLabel="Billing plan" style={s.plans}>
            {shown.map((plan) => {
              const active = plan.id === selectedId;
              return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${planName(plan)}, ${billingSummary(plan)}`}
                  accessibilityState={{ checked: active }}
                  onPress={() => setSelectedId(plan.id)}
                  style={[
                    s.plan,
                    {
                      backgroundColor: active ? theme.sentenceHighlight : theme.surface,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <View style={s.planTop}>
                    <Text style={[s.benefitTitle, { color: theme.text }]}>{planName(plan)}</Text>
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={active ? theme.accentText : theme.mutedText}
                    />
                  </View>
                  <Text style={[s.price, { color: theme.text }]}>{priceLabel(plan)}</Text>
                  <Text style={[s.detail, { color: theme.mutedText }]}>{billingSummary(plan)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {selected ? (
          <Text accessibilityLiveRegion="polite" style={[s.terms, { color: theme.mutedText }]}>
            {billingTerms(selected, { now: now(), store: STORE, formatDate: formatLongDate })}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sign out${auth.user?.email ? ` of ${auth.user.email}` : ""}`}
          disabled={working}
          onPress={() => void auth.signOut()}
          style={({ pressed }) => [s.signOut, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[s.signOutText, { color: theme.mutedText }]}>
            {auth.user?.email ? `Signed in as ${auth.user.email} · ` : ""}
            <Text style={{ color: theme.accentText, fontWeight: "800" }}>Sign out</Text>
          </Text>
        </Pressable>
      </ScrollView>

      {/* The offer, the button, and Restore stay in view while the rest scrolls. */}
      <SafeAreaView
        edges={["bottom"]}
        style={[s.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}
      >
        {message ? <FormMessage icon={message.icon} text={message.text} /> : null}
        {unavailable ? (
          subscription.canBypass ? (
            <SecondaryButton
              label="Continue without a subscription (testing build)"
              onPress={subscription.bypass}
            />
          ) : null
        ) : plans === null ? (
          <View accessible accessibilityLabel="Loading Votic Premium" style={s.loading}>
            <ActivityIndicator color={theme.accentText} />
          </View>
        ) : !shown.length ? (
          <>
            <Text accessibilityRole="alert" style={[s.summary, { color: theme.text }]}>
              {loadFailed
                ? "Votic couldn't load Votic Premium. Check your connection and try again."
                : "Votic Premium isn't available to buy right now. Please try again later."}
            </Text>
            <SecondaryButton label="Try again" onPress={retry} />
          </>
        ) : (
          <>
            {selected ? (
              <Text style={[s.summary, { color: theme.mutedText }]}>{billingSummary(selected)}</Text>
            ) : null}
            <PrimaryButton
              label={primaryActionLabel(selected)}
              busy={purchasing}
              disabled={!selected || restoring}
              accessibilityHint={selected ? billingSummary(selected) : undefined}
              onPress={() => void purchase()}
            />
          </>
        )}
        <View style={s.links}>
          <FooterLink label="Manage account" disabled={working} onPress={() => router.push("/account")} />
          {!unavailable ? (
            <FooterLink
              label={restoring ? "Restoring…" : "Restore Purchases"}
              disabled={working}
              onPress={() => void restore()}
            />
          ) : null}
          {legal.termsUrl ? (
            <FooterLink label="Terms" onPress={() => void Linking.openURL(legal.termsUrl!)} />
          ) : null}
          {legal.privacyUrl ? (
            <FooterLink label="Privacy" onPress={() => void Linking.openURL(legal.privacyUrl!)} />
          ) : null}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function FooterLink({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.link, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }]}
    >
      <Text style={[s.linkText, { color: theme.mutedText }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
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
  price: { fontSize: 28, fontWeight: "800" },
  terms: { fontSize: 12, lineHeight: 18 },
  signOut: { minHeight: controlSizes.minimumTouch, justifyContent: "center", alignSelf: "center" },
  signOutText: { fontSize: 14, textAlign: "center" },
  footer: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1 },
  loading: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  summary: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: spacing.lg },
  link: { minHeight: controlSizes.minimumTouch, justifyContent: "center", paddingHorizontal: spacing.xs },
  linkText: { fontSize: 14, fontWeight: "700" },
});
