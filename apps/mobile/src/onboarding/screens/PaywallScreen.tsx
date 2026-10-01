import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "../../design/tokens";
import { hasAccess } from "../../subscription/entitlement";
import { billingSummary, billingTerms, planName, primaryActionLabel } from "../../subscription/offerText";
import { SubscriptionPlan, SubscriptionUnavailableReason } from "../../subscription/subscriptionTypes";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { useAccount } from "../AccountProvider";
import {
  ChoiceCard,
  Notice,
  OnboardingScreen,
  PrimaryButton,
  SecondaryButton,
  TextLink,
} from "../components/OnboardingUI";
import { Goal } from "../onboardingModel";

/** Things Votic does today, ordered by what the person said they want help with. No unsupported claims. */
const VALUE_STATEMENTS: {
  text: string;
  icon:
    | "chatbubble-ellipses-outline"
    | "headset-outline"
    | "bookmark-outline"
    | "play-forward-outline"
    | "bulb-outline";
  goals: Goal[];
}[] = [
  {
    text: "Understand difficult documents",
    icon: "bulb-outline",
    goals: ["understand-reading", "explain-difficult", "summarize"],
  },
  {
    text: "Ask Votic questions while you read",
    icon: "chatbubble-ellipses-outline",
    goals: ["explain-difficult", "find-quickly", "summarize"],
  },
  { text: "Listen to your documents", icon: "headset-outline", goals: ["listen-instead", "stay-focused"] },
  {
    text: "Capture and organize important information",
    icon: "bookmark-outline",
    goals: ["take-notes", "remember"],
  },
  { text: "Pick up where you left off", icon: "play-forward-outline", goals: ["stay-focused", "remember"] },
];

export function valueStatementsFor(goals: Goal[]) {
  const score = (goalsFor: Goal[]) => goalsFor.filter((goal) => goals.includes(goal)).length;
  return [...VALUE_STATEMENTS]
    .map((item, index) => ({ ...item, index, score: score(item.goals) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4);
}

const UNAVAILABLE_MESSAGES: Record<SubscriptionUnavailableReason, string> = {
  "not-configured":
    "Subscriptions aren't set up in this version of Votic yet, so nothing can be purchased here.",
  "expo-go": "Subscriptions can't be purchased in Expo Go. They need a development or store build of Votic.",
  "unsupported-platform": "Subscriptions are available in the Votic app for iPhone and Android.",
};

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/**
 * The last step of setup. Nothing here grants access by itself: access starts only when RevenueCat
 * confirms an active entitlement (including a free trial) from the App Store or Google Play.
 */
export function PaywallScreen({ now = () => new Date() }: { now?: () => Date }) {
  const { theme } = useVoticTheme();
  const { services, onboarding, entitlement, setEntitlement, signOut, setDevelopmentBypass, isDevelopment } =
    useAccount();
  const { subscriptions, legal } = services;
  const unavailable = subscriptions.unavailableReason;
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);
  const busy = useRef(false);

  // Bumped by "Try Again"; each attempt asks the store for the current plans.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (unavailable) return;
    let current = true;
    subscriptions.getPlans().then(
      (found) => {
        if (!current) return;
        setPlans(found);
        setSelectedId(found.find((plan) => plan.trial)?.id ?? found[0]?.id ?? null);
      },
      () => {
        if (!current) return;
        setLoadError(true);
        setPlans([]);
      },
    );
    return () => {
      current = false;
    };
  }, [subscriptions, unavailable, attempt]);
  function retryPlans() {
    setLoadError(false);
    setPlans(null);
    setAttempt((value) => value + 1);
  }

  // Someone whose trial or subscription ended has already used the free trial, so none is promised.
  const hadSubscription = entitlement.status === "expired";
  const shown = (plans || []).map((plan) => (hadSubscription ? { ...plan, trial: null } : plan));
  const selected = shown.find((plan) => plan.id === selectedId) ?? null;
  const store = Platform.OS === "ios" ? "App Store" : "Google Play";

  async function purchase() {
    if (!selected || busy.current) return;
    busy.current = true;
    setPurchasing(true);
    setMessage(null);
    try {
      const outcome = await subscriptions.purchase(selected.id);
      if (outcome.kind === "purchased") {
        if (hasAccess(outcome.entitlement.status)) setEntitlement(outcome.entitlement);
        else
          setMessage({
            tone: "info",
            text: "Your purchase went through, but Votic couldn't confirm it yet. Tap Restore Purchases in a moment.",
          });
      } else if (outcome.kind === "pending")
        setMessage({
          tone: "info",
          text: "Your purchase is waiting for approval, for example from a family organizer or your bank. Votic will unlock as soon as it's approved.",
        });
      else if (outcome.kind === "failed") setMessage({ tone: "error", text: outcome.message });
      // A cancelled purchase sheet needs no message; the paywall stays as it was.
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
      const restored = await subscriptions.restore();
      if (hasAccess(restored.status)) setEntitlement(restored);
      else if (restored.status === "unknown")
        setMessage({
          tone: "error",
          text: "Votic couldn't reach the store. Check your connection and try again.",
        });
      else
        setMessage({
          tone: "info",
          text: `No active Votic subscription was found for this ${store} account.`,
        });
    } finally {
      busy.current = false;
      setRestoring(false);
    }
  }

  const title = selected?.trial ? "Start your free trial" : "Subscribe to Votic";
  const subtitle = selected?.trial
    ? "Try Votic free, then continue with your Votic subscription."
    : "Continue with your Votic subscription.";
  const statusNotice =
    entitlement.status === "expired"
      ? "Your Votic subscription has ended. Subscribe again to keep using Votic."
      : entitlement.status === "unknown" && !unavailable
        ? "Votic couldn't confirm your subscription. If you already subscribed, tap Restore Purchases."
        : null;

  return (
    <OnboardingScreen
      footer={
        unavailable ? (
          isDevelopment ? (
            <SecondaryButton
              label="Continue without a subscription (development build)"
              onPress={() => setDevelopmentBypass({ paywall: true })}
            />
          ) : undefined
        ) : (
          <>
            <PrimaryButton
              label={primaryActionLabel(selected)}
              onPress={() => void purchase()}
              loading={purchasing}
              disabled={!selected || restoring}
            />
            {selected ? (
              <Text style={[s.summary, { color: theme.text }]}>{billingSummary(selected)}</Text>
            ) : null}
          </>
        )
      }
    >
      <View style={s.heading}>
        <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
          {unavailable ? "Votic subscription" : title}
        </Text>
        {!unavailable ? <Text style={[s.subtitle, { color: theme.mutedText }]}>{subtitle}</Text> : null}
      </View>
      <View style={s.values}>
        {valueStatementsFor(onboarding?.answers.goals ?? []).map((item) => (
          <View key={item.text} style={s.value}>
            <Ionicons name={item.icon} size={22} color={theme.accent} />
            <Text style={[s.valueText, { color: theme.text }]}>{item.text}</Text>
          </View>
        ))}
      </View>
      {unavailable ? <Notice>{UNAVAILABLE_MESSAGES[unavailable]}</Notice> : null}
      {statusNotice ? <Notice>{statusNotice}</Notice> : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {!unavailable && plans === null ? (
        <ActivityIndicator accessibilityLabel="Loading subscription options" color={theme.accent} />
      ) : null}
      {!unavailable && plans !== null && !shown.length ? (
        <>
          <Notice tone={loadError ? "error" : "info"}>
            {loadError
              ? "Votic couldn't load subscription options. Check your connection and try again."
              : "No subscription options are available right now. Please try again later."}
          </Notice>
          <SecondaryButton label="Try Again" onPress={retryPlans} />
        </>
      ) : null}
      {shown.length > 1 ? (
        <View accessibilityRole="radiogroup" style={s.plans}>
          {shown.map((plan) => (
            <ChoiceCard
              key={plan.id}
              kind="single"
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
          {billingTerms(selected, { now: now(), store, formatDate })}
        </Text>
      ) : null}
      {!unavailable ? (
        <TextLink
          label="Restore Purchases"
          onPress={() => void restore()}
          disabled={purchasing || restoring}
        />
      ) : null}
      <View style={s.links}>
        {legal.termsUrl ? (
          <TextLink label="Terms of Service" onPress={() => void Linking.openURL(legal.termsUrl!)} />
        ) : null}
        {legal.privacyUrl ? (
          <TextLink label="Privacy Policy" onPress={() => void Linking.openURL(legal.privacyUrl!)} />
        ) : null}
      </View>
      <TextLink label="Sign out" onPress={() => void signOut()} disabled={purchasing || restoring} />
    </OnboardingScreen>
  );
}

const s = StyleSheet.create({
  heading: { gap: spacing.sm },
  title: { ...typography.screenTitle, fontSize: 28 },
  subtitle: { ...typography.body },
  values: { gap: spacing.md, paddingVertical: spacing.xs },
  value: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  valueText: { flex: 1, fontSize: 17, fontWeight: "600", lineHeight: 23 },
  plans: { gap: spacing.sm },
  summary: { fontSize: 15, fontWeight: "600", textAlign: "center", lineHeight: 21 },
  terms: { fontSize: 13, lineHeight: 19 },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: spacing.lg },
});
