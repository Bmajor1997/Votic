import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { ai_usage } from "../api/voticApi";
import { useAuth } from "../auth/AuthProvider";
import { radii, spacing, typography } from "../design/tokens";
import { PrimaryButton, SecondaryButton } from "../onboarding/components";
import { AiUsage, subscribe_ai_usage_changes, usage_reset_label } from "../subscription/aiUsage";
import { useSubscription } from "../subscription/SubscriptionProvider";
import { CreditProduct } from "../subscription/subscriptionTypes";
import { useVoticTheme } from "../theme/ThemeProvider";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; usage: AiUsage };

/** Server-reported usage for the signed-in account; refreshed on foregrounding, store changes and finished AI requests. */
function useAiUsage() {
  const { entitlement } = useSubscription();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const generation = useRef(0);
  const refresh = useCallback(() => {
    const token = ++generation.current;
    ai_usage().then(
      (usage) => {
        if (token === generation.current) setLoad({ state: "ready", usage });
      },
      (error: unknown) => {
        if (token === generation.current)
          setLoad({
            state: "error",
            message: error instanceof Error ? error.message : "Votic couldn't load your AI usage.",
          });
      },
    );
  }, []);
  // A renewal, expiry or refund reported by the store reloads from the server.
  useEffect(refresh, [refresh, entitlement.status, entitlement.expiresAt]);
  useEffect(() => {
    const stop = subscribe_ai_usage_changes(refresh);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      stop();
      listener.remove();
      generation.current += 1;
    };
  }, [refresh]);
  return { load, refresh };
}

/** A settled fill, never a loop; Reduce Motion shows the final width at once. */
function UsageBar({ percent }: { percent: number }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [fill] = useState(() => new Animated.Value(reduceMotion ? percent : 0));
  useEffect(() => {
    if (reduceMotion) {
      fill.setValue(percent);
      return;
    }
    const animation = Animated.timing(fill, {
      toValue: percent,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [percent, reduceMotion, fill]);
  return (
    <View
      testID="ai-usage-bar"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Monthly AI allowance"
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}% remaining` }}
      style={[s.track, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
    >
      <Animated.View
        style={[
          s.fill,
          {
            backgroundColor: theme.accent,
            width: fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
          },
        ]}
      />
    </View>
  );
}

function AllowanceCard({ monthly, plan }: { monthly: NonNullable<AiUsage["monthly"]>; plan: string }) {
  const { theme } = useVoticTheme();
  const { fontScale, width } = useWindowDimensions();
  return (
    <View style={[s.hero, { backgroundColor: theme.brandTint, borderColor: theme.border }]}>
      <Text
        style={[s.eyebrow, { color: theme.mutedText }]}
      >{`${plan.toUpperCase()} · MONTHLY AI ALLOWANCE`}</Text>
      <View style={s.heroRow}>
        <Text accessibilityRole="header" style={[s.heroPercent, { color: theme.accentText }]}>
          {monthly.percentRemaining}% remaining
        </Text>
        {width >= 340 && fontScale <= 1.3 ? (
          <Image
            source={require("../../assets/ai-usage-robot.png")}
            accessibilityIgnoresInvertColors
            accessible={false}
            style={s.robot}
            resizeMode="contain"
          />
        ) : null}
      </View>
      <UsageBar percent={monthly.percentRemaining} />
      <Text style={[s.detail, { color: theme.mutedText }]}>{usage_reset_label(monthly)}</Text>
    </View>
  );
}

function CreditUses() {
  const { theme } = useVoticTheme();
  const items = [
    { icon: "chatbubble-ellipses-outline" as const, label: "AI questions" },
    { icon: "document-text-outline" as const, label: "Summaries" },
    { icon: "camera-outline" as const, label: "Camera scans" },
    { icon: "mic-outline" as const, label: "Voice questions" },
  ];
  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text accessibilityRole="header" style={[s.sectionTitle, { color: theme.text }]}>
        What uses credits?
      </Text>
      {items.map((item) => (
        <View key={item.label} style={s.useRow}>
          <View style={[s.useIcon, { backgroundColor: theme.brandTint }]}>
            <Ionicons name={item.icon} size={21} color={theme.accentText} />
          </View>
          <Text style={[s.detail, { color: theme.text }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Additional usage that the server confirmed; it is used after the monthly allowance and survives renewal. */
function PurchasedCard({ remaining }: { remaining: number }) {
  const { theme } = useVoticTheme();
  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text accessibilityRole="header" style={[s.sectionTitle, { color: theme.text }]}>
        Additional AI credits
      </Text>
      <Text style={[s.percent, { color: theme.text }]}>
        {remaining.toLocaleString()} {remaining === 1 ? "credit" : "credits"} available
      </Text>
      <Text style={[s.detail, { color: theme.mutedText }]}>
        Used after your monthly allowance. These credits don&apos;t expire when your plan renews.
      </Text>
    </View>
  );
}

const PURCHASE_MESSAGES = {
  purchased:
    "Thanks. Your additional AI usage appears here once the store confirms the purchase. This usually takes a moment.",
  pending: "Your purchase is waiting for approval. Your additional AI usage appears here once it's approved.",
};

/** Only store products the server credits; nothing is offered when the store or the server can't confirm it. */
function BuyMore({
  productIds,
  exhausted,
  on_purchased,
}: {
  productIds: string[];
  exhausted: boolean;
  on_purchased: () => void;
}) {
  const { theme } = useVoticTheme();
  const { service } = useSubscription();
  const [products, setProducts] = useState<CreditProduct[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const supported =
    !service.unavailableReason && Boolean(service.get_credit_products && service.purchase_credits);
  const key = productIds.join(",");
  useEffect(() => {
    if (!supported || !key) return;
    let current = true;
    service.get_credit_products!(key.split(",")).then(
      (found) => current && setProducts(found),
      () => current && setProducts([]),
    );
    return () => {
      current = false;
    };
  }, [service, supported, key]);
  async function buy(product: CreditProduct) {
    if (busy) return;
    setBusy(product.productId);
    setMessage("");
    try {
      const current = await ai_usage();
      if (current.plan?.free || !current.purchaseProducts.includes(product.productId)) {
        setMessage("Extra credits are available with Votic Plus. Refresh your plan and try again.");
        on_purchased();
        setBusy(null);
        return;
      }
    } catch {
      setMessage("Votic couldn't confirm your plan. Check your connection and try again.");
      setBusy(null);
      return;
    }
    const outcome = await service.purchase_credits!(product.productId).catch(() => ({
      kind: "failed" as const,
      message: "Your purchase couldn't be confirmed. Please try again.",
    }));
    setBusy(null);
    if (outcome.kind === "purchased" || outcome.kind === "pending") {
      setMessage(PURCHASE_MESSAGES[outcome.kind]);
      on_purchased();
    } else if (outcome.kind === "failed") setMessage(outcome.message);
  }
  const unavailable = !productIds.length || !supported || products?.length === 0;
  if (unavailable && !exhausted) return null;
  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text accessibilityRole="header" style={[s.sectionTitle, { color: theme.text }]}>
        Need more credits?
      </Text>
      <Text style={[s.detail, { color: theme.mutedText }]}>Add extra AI credits whenever you need them.</Text>
      {unavailable ? (
        <Text style={[s.detail, { color: theme.mutedText }]}>
          {productIds.length && !supported
            ? "Buying additional AI usage needs the store version of Votic."
            : "Additional AI usage isn't available to buy right now. Your allowance renews on the date above."}
        </Text>
      ) : !products ? (
        <ActivityIndicator accessibilityLabel="Loading additional AI usage" color={theme.accent} />
      ) : (
        products.map((product) => (
          <PrimaryButton
            key={product.productId}
            label={`${product.title} · ${product.priceString}`}
            busy={busy === product.productId}
            disabled={Boolean(busy) && busy !== product.productId}
            accessibilityHint={`One-time purchase of ${product.priceString}. It doesn't change your subscription.`}
            on_press={() => void buy(product)}
          />
        ))
      )}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={[s.detail, { color: theme.text }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function UsageState({ usage, refresh }: { usage: AiUsage; refresh: () => void }) {
  const { theme } = useVoticTheme();
  const { entitlement, beta } = useSubscription();
  if (usage.status === "active" && usage.monthly)
    return (
      <>
        <AllowanceCard monthly={usage.monthly} plan={usage.plan?.name ?? "Votic"} />
        <CreditUses />
        {usage.purchased ? <PurchasedCard remaining={usage.purchased.remaining} /> : null}
        {/* Beta testers are never asked to pay, so no extra-usage prices for them. */}
        {beta || !usage.plan || usage.plan.free ? null : (
          <BuyMore
            productIds={usage.purchaseProducts}
            exhausted={usage.monthly.percentRemaining === 0 && !usage.purchased?.remaining}
            on_purchased={refresh}
          />
        )}
      </>
    );
  const message =
    usage.status === "not-subscribed"
      ? entitlement.status === "expired"
        ? "Your Votic Plus subscription has ended. Reading and your notes are still here with Votic Free."
        : "Votic Free includes 75 AI credits a month. Votic Plus includes more."
      : usage.status === "unmetered"
        ? "Your plan doesn't use a monthly AI allowance."
        : "AI usage details aren't available from this Votic server.";
  return (
    <>
      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[s.detail, { color: theme.text }]}>{message}</Text>
      </View>
      {usage.status === "not-subscribed" ? (
        <SecondaryButton label="See Votic Plus" on_press={() => router.push("/paywall")} />
      ) : null}
    </>
  );
}

/** Keyed by account, so another account's usage is never shown, even briefly. */
export function AiUsageSettings() {
  const { user } = useAuth();
  return <AccountAiUsage key={user?.uid ?? "signed-out"} />;
}

function AccountAiUsage() {
  const { theme } = useVoticTheme();
  const { load, refresh } = useAiUsage();
  return (
    <View style={s.content}>
      {load.state === "loading" ? (
        <View style={s.loading}>
          <ActivityIndicator accessibilityLabel="Loading AI usage" color={theme.accent} />
        </View>
      ) : load.state === "error" ? (
        <View style={s.group}>
          <Text accessibilityRole="alert" style={[s.detail, { color: theme.text }]}>
            {load.message}
          </Text>
          <SecondaryButton label="Try again" on_press={refresh} />
        </View>
      ) : (
        <UsageState usage={load.usage} refresh={refresh} />
      )}
      <Text style={[s.note, { color: theme.mutedText }]}>
        AI usage covers answers about your documents, summaries, voice questions, and reading text from scans.
        Reading, listening, and notes don&apos;t use it.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { gap: spacing.lg },
  group: { gap: spacing.md },
  loading: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  hero: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  heroPercent: { flex: 1, fontSize: 32, lineHeight: 40, fontWeight: "800", letterSpacing: -0.5 },
  robot: { width: 105, height: 110 },
  useRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  useIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radii.md },
  eyebrow: { ...typography.eyebrow },
  percent: { fontSize: 32, lineHeight: 40, fontWeight: "800", letterSpacing: -0.5 },
  sectionTitle: { ...typography.sectionTitle },
  track: { height: 12, borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radii.pill },
  detail: { fontSize: 16, lineHeight: 24 },
  note: { fontSize: 14, lineHeight: 21 },
});
