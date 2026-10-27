import { editorial } from "../src/design/editorial";
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
import { PaywallBenefits, PaywallIntro, PaywallQuestions } from "../src/subscription/PaywallContent";
import { RiseTimeline, SettleOnChange } from "../src/motion/Rise";
import { usePurchaseCelebration } from "../src/subscription/PurchaseCelebration";
import { annual_value, default_plan, plus_plans } from "../src/subscription/paywallPresentation";
import { BillingSelector } from "../src/subscription/BillingSelector";
import { paywallStyles as p } from "../src/subscription/paywallStyles";
import { controlSizes, spacing } from "../src/design/tokens";
import { FormMessage } from "../src/onboarding/accountForms";
import { PrimaryButton, SecondaryButton } from "../src/onboarding/components";
import { has_access } from "../src/subscription/entitlement";
import {
  billing_period_label,
  billing_summary,
  billing_terms,
  offer_title,
  trial_timeline,
  plan_card_detail,
  primary_action_label,
} from "../src/subscription/offerText";
import { useSubscription } from "../src/subscription/SubscriptionProvider";
import { STORE_SUBSCRIPTIONS_URL } from "../src/subscription/subscriptionStatus";
import { store_deadline } from "../src/subscription/storeDeadline";
import { SubscriptionPlan, SubscriptionUnavailableReason } from "../src/subscription/subscriptionTypes";
import { useVoticTheme } from "../src/theme/ThemeProvider";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const UNAVAILABLE_MESSAGES: Record<SubscriptionUnavailableReason, string> = {
  "not-configured":
    "Subscriptions aren't set up in this build of Votic yet, so nothing can be purchased here.",
  "expo-go": "Subscriptions can't be purchased in Expo Go. They need a development or store build of Votic.",
  "unsupported-platform": "Votic Plus is available in the Votic app for iPhone and Android.",
};

const STORE = Platform.OS === "ios" ? "App Store" : "Google Play";

function format_long_date(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

type Message = { icon?: IconName; text: string };

/**
 * Votic Plus. Nothing on this screen grants access by itself: access starts only when RevenueCat confirms
 * an active entitlement (a free trial counts) from the App Store or Google Play.
 */
export default function Paywall({ now = () => new Date() }: { now?: () => Date }) {
  const { theme } = useVoticTheme();
  const auth = useAuth();
  const inlineCheckout = true;
  const celebration = usePurchaseCelebration();
  const subscription = useSubscription();
  const { service, entitlement } = subscription;
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
    store_deadline(service.getPlans()).then(
      (found) => {
        if (!current) return;
        setPlans(found);
        // Keep the person's choice across a reload; otherwise start on monthly.
        setSelectedId((previous) =>
          plus_plans(found).some((plan) => plan.id === previous)
            ? previous
            : (default_plan(found)?.id ?? null),
        );
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
    if (entitlement.status === "unknown") void subscription.refresh().catch(() => {});
  }

  // Eligibility comes from the store; an expired paid subscription does not prove a trial was used.
  const shown = plus_plans(plans || []);
  const selected = shown.find((plan) => plan.id === selectedId) ?? default_plan(shown);
  const working = purchasing || restoring;

  async function purchase() {
    if (!selected || busy.current) return;
    busy.current = true;
    setPurchasing(true);
    setMessage(null);
    try {
      const outcome = await service.purchase(selected.id);
      if (outcome.kind === "purchased") {
        if (has_access(outcome.entitlement.status)) {
          await celebration.celebrate({
            title: "You're in.",
            detail: "Welcome to Votic Plus. Your library is ready.",
          });
          subscription.setEntitlement(outcome.entitlement);
        } else
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
    } catch {
      setMessage({
        text: "Votic couldn't confirm your purchase. Check your connection and use Restore Purchases before trying again.",
      });
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
      if (has_access(restored.status)) {
        await celebration.celebrate({
          title: "Welcome back.",
          detail: "Your Votic Plus subscription is restored.",
        });
        subscription.setEntitlement(restored);
      } else if (restored.status === "unknown")
        setMessage({ text: "Votic couldn't reach the store. Check your connection and try again." });
      else
        setMessage({
          icon: "information-circle-outline",
          text: `No active Votic Plus subscription was found for this ${STORE} account.`,
        });
    } catch {
      setMessage({
        text: "Votic couldn't reach the store. Check your connection and try Restore Purchases again.",
      });
    } finally {
      busy.current = false;
      setRestoring(false);
    }
  }

  const statusNotice =
    entitlement.status === "expired"
      ? "Your Votic Plus subscription has ended. Subscribe again to keep reading with Votic."
      : entitlement.status === "unknown" && !unavailable && !subscription.checking
        ? "Votic couldn't confirm your subscription. If you already subscribed, tap Restore Purchases."
        : null;

  const checkout = (
    <SafeAreaView
      edges={["bottom"]}
      style={[
        s.footer,
        inlineCheckout && s.inlineFooter,
        { borderTopColor: theme.border, backgroundColor: theme.surface },
      ]}
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
        <View accessible accessibilityLabel="Loading Votic Plus" style={s.loading}>
          <ActivityIndicator color={theme.accentText} />
        </View>
      ) : !shown.length ? (
        <>
          <Text accessibilityRole="alert" style={[s.summary, { color: theme.text }]}>
            {loadFailed
              ? "Votic couldn't load Votic Plus. Check your connection and try again."
              : "Votic Plus isn't available to buy right now. Please try again later."}
          </Text>
          <SecondaryButton label="Try again" onPress={retry} />
        </>
      ) : (
        <>
          {selected ? (
            <Text accessibilityLiveRegion="polite" style={[s.summary, { color: theme.text }]}>
              {billing_summary(selected, STORE)}
            </Text>
          ) : null}
          <PrimaryButton
            label={primary_action_label(selected)}
            busy={purchasing}
            disabled={!selected || restoring}
            accessibilityHint={selected ? billing_summary(selected, STORE) : undefined}
            onPress={() => void purchase()}
          />
        </>
      )}
    </SafeAreaView>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[s.fill, { backgroundColor: theme.background }]}>
      <ScrollView
        testID="paywall-content"
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <RiseTimeline>
          <PaywallIntro />
        </RiseTimeline>
        <Text accessibilityRole="header" style={[p.sectionTitle, s.plansTitle, { color: theme.text }]}>
          Votic Plus
        </Text>
        {unavailable ? (
          <FormMessage icon="information-circle-outline" text={UNAVAILABLE_MESSAGES[unavailable]} />
        ) : null}
        {statusNotice ? <FormMessage icon="information-circle-outline" text={statusNotice} /> : null}
        {subscription.recoveryError ? (
          <Text accessibilityRole="alert" style={{ color: theme.text }}>
            {subscription.recoveryError}
          </Text>
        ) : null}
        {shown.length > 1 ? (
          <BillingSelector
            plans={shown}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            disabled={working}
          />
        ) : null}
        {shown.length === 1 && selected ? <OfferCard plan={selected} plans={shown} now={now()} /> : null}
        <Text style={[p.detail, { color: theme.text }]}>
          A subscription is required to read, listen to, and ask questions about your documents.
        </Text>
        {inlineCheckout ? checkout : null}

        <RiseTimeline>
          <PaywallBenefits />
        </RiseTimeline>
        {shown.length > 1 && selected ? <OfferCard plan={selected} plans={shown} now={now()} /> : null}

        <PaywallQuestions store={STORE} />
        <CheckoutLinks working={working} restoring={restoring} restore={restore} onMessage={setMessage} />

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

      {celebration.overlay}
    </SafeAreaView>
  );
}

/** The one Votic Plus offer: the store's localized price and billing period, any trial, and the full terms. */
function OfferCard({ plan, plans, now }: { plan: SubscriptionPlan; plans: SubscriptionPlan[]; now: Date }) {
  const { theme } = useVoticTheme();
  const value = annual_value(plan, plans);
  return (
    <SettleOnChange changeKey={plan.id}>
      <View
        accessible
        accessibilityLabel={`Votic Plus, ${billing_summary(plan)}`}
        style={[s.plan, { backgroundColor: theme.sentenceHighlight, borderColor: theme.accent }]}
      >
        <Text style={[s.price, { color: theme.text }]}>
          {plan.priceString}
          <Text style={s.pricePeriod}>
            {plan.billingPeriod ? `/${billing_period_label(plan.billingPeriod)}` : ""}
          </Text>
        </Text>
        <Text style={[p.detail, { color: theme.mutedText }]}>
          {plan.billingPeriod ? "Billed every " + billing_period_label(plan.billingPeriod) + ". " : ""}
          Cancel anytime in {STORE}.
        </Text>
        {value ? (
          <Text style={[p.detail, { color: theme.mutedText }]}>
            Equivalent to {value.equivalent}/month, billed yearly. {value.comparison}.
          </Text>
        ) : null}
        <Text style={[p.detail, { color: theme.mutedText }]}>Same Votic Plus features on either plan.</Text>
        {plan_card_detail(plan) ? (
          <Text style={[p.detail, { color: theme.mutedText }]}>{plan_card_detail(plan)}</Text>
        ) : null}
      </View>
      {plan.trial ? (
        <View style={[s.timeline, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text accessibilityRole="header" style={[p.sectionTitle, { color: theme.text }]}>
            {offer_title(plan)}
          </Text>
          {trial_timeline(plan, { now, formatDate: format_long_date }).map((item, index) => (
            <View key={item.when} style={s.timelineRow}>
              <View style={[s.stepNumber, { backgroundColor: theme.brandTint }]}>
                <Text style={[p.benefitTitle, { color: theme.accentText }]}>{index + 1}</Text>
              </View>
              <View style={s.benefitCopy}>
                <Text style={[p.benefitTitle, { color: theme.text }]}>{item.when}</Text>
                <Text style={[p.detail, { color: theme.mutedText }]}>{item.what}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <Text accessibilityLiveRegion="polite" style={[s.terms, { color: theme.mutedText }]}>
        {billing_terms(plan, { now, store: STORE, formatDate: format_long_date })}
      </Text>
    </SettleOnChange>
  );
}

/** Store management and recovery remain available even when offerings fail to load. */
function CheckoutLinks({
  working,
  restoring,
  restore,
  onMessage,
}: {
  working: boolean;
  restoring: boolean;
  restore: () => Promise<void>;
  onMessage: (message: Message) => void;
}) {
  const { service, legal } = useSubscription();
  const unavailable = service.unavailableReason;
  return (
    <>
      {!unavailable ? (
        <FooterLink
          label={`Manage or cancel in ${STORE}`}
          disabled={working}
          onPress={() =>
            void Linking.openURL(STORE_SUBSCRIPTIONS_URL).catch(() =>
              onMessage({
                text: `Couldn't open ${STORE}. Open your store app's subscription settings to manage or cancel.`,
              }),
            )
          }
        />
      ) : null}
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
    </>
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
  plansTitle: { marginTop: spacing.sm },
  timeline: { padding: 18, gap: 20, borderRadius: 20, borderWidth: 1 },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  fill: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  benefitCopy: { flex: 1, gap: spacing.xs },
  plan: {
    borderWidth: 2,
    borderRadius: 22,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  price: { ...editorial, fontSize: 30, lineHeight: 38 },
  pricePeriod: { fontSize: 14, lineHeight: 22, letterSpacing: 0 },
  terms: { fontSize: 12, lineHeight: 18 },
  signOut: { minHeight: controlSizes.minimumTouch, justifyContent: "center", alignSelf: "center" },
  signOutText: { fontSize: 14, textAlign: "center" },
  inlineFooter: { borderTopWidth: 0, width: "100%", maxWidth: 360, alignSelf: "center" },
  footer: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1 },
  loading: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  summary: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: spacing.lg },
  link: { minHeight: controlSizes.minimumTouch, justifyContent: "center", paddingHorizontal: spacing.xs },
  linkText: { fontSize: 14, fontWeight: "700" },
});
