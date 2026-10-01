import { Ionicons } from "@expo/vector-icons";
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
import { OptionRow, PrimaryButton, SecondaryButton } from "../src/onboarding/components";
import { hasAccess } from "../src/subscription/entitlement";
import {
  billingSummary,
  billingTerms,
  offerTitle,
  planName,
  primaryActionLabel,
  trialTimeline,
} from "../src/subscription/offerText";
import { useSubscription } from "../src/subscription/SubscriptionProvider";
import { SubscriptionPlan, SubscriptionUnavailableReason } from "../src/subscription/subscriptionTypes";
import { useVoticTheme } from "../src/theme/ThemeProvider";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Everything here exists in Votic today. Nothing is listed that the app can't do. */
export const PREMIUM_FEATURES: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "document-text-outline",
    title: "Read any document",
    detail: "PDF, Word, PowerPoint, EPUB, and text, in a Reader you can adjust.",
  },
  {
    icon: "headset-outline",
    title: "Listen as it's read aloud",
    detail: "Follow along with word and sentence highlighting, at your speed.",
  },
  {
    icon: "chatbubble-ellipses-outline",
    title: "Ask Votic",
    detail: "Ask questions about what you're reading and get answers from it.",
  },
  {
    icon: "bookmark-outline",
    title: "Notes linked to the page",
    detail: "Save passages and notes that take you back to the exact spot.",
  },
  {
    icon: "play-forward-outline",
    title: "Pick up where you left off",
    detail: "Votic remembers your place in every document.",
  },
  {
    icon: "stats-chart-outline",
    title: "Reading statistics",
    detail: "See your reading and listening time and activity.",
  },
];

const UNAVAILABLE_MESSAGES: Record<SubscriptionUnavailableReason, string> = {
  "not-configured":
    "Subscriptions aren't set up in this build of Votic yet, so nothing can be purchased here.",
  "expo-go": "Subscriptions can't be purchased in Expo Go. They need a development or store build of Votic.",
  "unsupported-platform": "Votic Premium is available in the Votic app for iPhone and Android.",
};

const STORE = Platform.OS === "ios" ? "App Store" : "Google Play";

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}
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
  const timeline = selected ? trialTimeline(selected, { now: now(), formatDate }) : [];

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[s.fill, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.brand}>
          <VoticLogo />
        </View>
        <View style={s.heading}>
          <Text style={[s.eyebrow, { color: theme.accentText }]}>VOTIC PREMIUM</Text>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            {unavailable ? "Get Votic Premium" : offerTitle(selected)}
          </Text>
          <Text style={[s.subtitle, { color: theme.mutedText }]}>
            Read, listen to, and ask about any document.
          </Text>
        </View>

        {timeline.length ? (
          <View accessibilityLabel="How your free trial works" style={s.timeline}>
            {timeline.map((item, index) => (
              <View key={item.when} style={s.timelineRow}>
                <View style={s.timelineMarker}>
                  <View
                    style={[
                      s.dot,
                      {
                        backgroundColor: index === 0 ? theme.accent : theme.surface,
                        borderColor: theme.accent,
                      },
                    ]}
                  />
                  {index < timeline.length - 1 ? (
                    <View style={[s.line, { backgroundColor: theme.border }]} />
                  ) : null}
                </View>
                <View style={s.timelineCopy}>
                  <Text style={[s.timelineWhen, { color: theme.text }]}>{item.when}</Text>
                  <Text style={[s.timelineWhat, { color: theme.mutedText }]}>{item.what}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View
          accessibilityLabel="Included with Votic Premium"
          style={[s.table, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <View style={[s.tableHeader, { borderBottomColor: theme.border }]}>
            <Text style={[s.tableTitle, { color: theme.text }]}>What you get</Text>
            <Text style={[s.tableColumn, { color: theme.mutedText }]}>Included</Text>
          </View>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View
              key={feature.title}
              accessible
              accessibilityLabel={`${feature.title}. ${feature.detail} Included.`}
              style={[
                s.featureRow,
                index < PREMIUM_FEATURES.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <Ionicons name={feature.icon} size={21} color={theme.accentText} />
              <View style={s.featureCopy}>
                <Text style={[s.featureTitle, { color: theme.text }]}>{feature.title}</Text>
                <Text style={[s.featureDetail, { color: theme.mutedText }]}>{feature.detail}</Text>
              </View>
              <Ionicons name="checkmark" size={20} color={theme.accentText} />
            </View>
          ))}
        </View>

        {unavailable ? (
          <FormMessage icon="information-circle-outline" text={UNAVAILABLE_MESSAGES[unavailable]} />
        ) : null}
        {statusNotice ? <FormMessage icon="information-circle-outline" text={statusNotice} /> : null}

        {shown.length > 1 ? (
          <View accessibilityRole="radiogroup" style={s.plans}>
            {shown.map((plan) => (
              <OptionRow
                key={plan.id}
                label={planName(plan)}
                detail={billingSummary(plan)}
                selected={plan.id === selectedId}
                onPress={() => setSelectedId(plan.id)}
              />
            ))}
          </View>
        ) : null}

        {selected ? (
          <Text style={[s.terms, { color: theme.mutedText }]}>
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
        style={[s.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}
      >
        {message ? <FormMessage icon={message.icon} text={message.text} /> : null}
        {unavailable ? (
          subscription.canBypass ? (
            <SecondaryButton
              label="Continue without a subscription (development build)"
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
              <Text style={[s.summary, { color: theme.text }]}>{billingSummary(selected)}</Text>
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
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.xl },
  brand: { minHeight: 58, justifyContent: "center" },
  heading: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow },
  title: { ...typography.screenTitle, fontSize: 28, lineHeight: 34 },
  subtitle: { fontSize: 17, lineHeight: 24 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: spacing.md },
  timelineMarker: { width: 16, alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 3 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  timelineCopy: { flex: 1, gap: 2, paddingBottom: spacing.lg },
  timelineWhen: { fontSize: 16, fontWeight: "800" },
  timelineWhat: { fontSize: 15, lineHeight: 21 },
  table: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.lg },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableTitle: { fontSize: 16, fontWeight: "800" },
  tableColumn: { fontSize: 13, fontWeight: "700" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 16, fontWeight: "700" },
  featureDetail: { fontSize: 14, lineHeight: 19 },
  plans: { gap: spacing.sm },
  terms: { fontSize: 13, lineHeight: 19 },
  signOut: { minHeight: controlSizes.minimumTouch, justifyContent: "center", alignSelf: "center" },
  signOutText: { fontSize: 14, textAlign: "center" },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  loading: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  summary: { fontSize: 15, fontWeight: "600", lineHeight: 21, textAlign: "center" },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: spacing.lg },
  link: { minHeight: controlSizes.minimumTouch, justifyContent: "center", paddingHorizontal: spacing.xs },
  linkText: { fontSize: 14, fontWeight: "700" },
});
