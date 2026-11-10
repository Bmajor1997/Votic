import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ai_usage } from "../api/voticApi";
import { spacing, typography } from "../design/tokens";
import { PrimaryButton } from "../onboarding/components";
import { useVoticTheme } from "../theme/ThemeProvider";
import { notify_ai_usage_changed } from "./aiUsage";
import { useSubscription } from "./SubscriptionProvider";
import type { CreditProduct } from "./subscriptionTypes";

const PURCHASE_MESSAGES = {
  purchased:
    "Thanks. Your extra AI credits appear in AI Usage once the store confirms the purchase. This usually takes a moment.",
  pending: "Your purchase is waiting for approval. Your extra AI credits appear once it's approved.",
};

/**
 * One-time AI credit packs ("Just need a few more?"). Only store products the server credits are offered, and the
 * server is asked again right before buying; nothing is offered when the store or the server can't confirm it.
 */
export function CreditTopUp({
  productIds,
  exhausted = false,
  onPurchased,
  title,
  intro,
}: {
  productIds: string[];
  /** Explain why nothing can be bought, instead of hiding, when the person has no credits left. */
  exhausted?: boolean;
  onPurchased?: () => void;
  title: string;
  intro: string;
}) {
  const { theme } = useVoticTheme();
  const { service } = useSubscription();
  const [products, setProducts] = useState<CreditProduct[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const supported =
    !service.unavailableReason && Boolean(service.getCreditProducts && service.purchaseCredits);
  const key = productIds.join(",");
  useEffect(() => {
    if (!supported || !key) return;
    let current = true;
    service.getCreditProducts!(key.split(",")).then(
      (found) => current && setProducts(found),
      () => current && setProducts([]),
    );
    return () => {
      current = false;
    };
  }, [service, supported, key]);
  async function confirm_offered(productId: string) {
    try {
      const current = await ai_usage();
      if (current.purchaseProducts.includes(productId)) return true;
      setMessage("Extra AI credits aren't available to buy right now. Please try again later.");
    } catch {
      setMessage("Votic couldn't confirm your plan. Check your connection and try again.");
    }
    return false;
  }
  async function buy(product: CreditProduct) {
    if (busy) return;
    setBusy(product.productId);
    setMessage("");
    if (!(await confirm_offered(product.productId))) return setBusy(null);
    const outcome = await service.purchaseCredits!(product.productId).catch(() => ({
      kind: "failed" as const,
      message: "Your purchase couldn't be confirmed. Please try again.",
    }));
    setBusy(null);
    if (outcome.kind === "purchased" || outcome.kind === "pending") {
      setMessage(PURCHASE_MESSAGES[outcome.kind]);
      notify_ai_usage_changed();
      onPurchased?.();
    } else if (outcome.kind === "failed") setMessage(outcome.message);
  }
  const unavailable = !productIds.length || !supported || products?.length === 0;
  if (unavailable && !exhausted) return null;
  return (
    <View style={s.group}>
      <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
        {title}
      </Text>
      <Text style={[s.detail, { color: theme.mutedText }]}>{intro}</Text>
      {unavailable ? (
        <Text style={[s.detail, { color: theme.mutedText }]}>
          {productIds.length && !supported
            ? "Buying additional AI usage needs the store version of Votic."
            : "Additional AI usage isn't available to buy right now. Your allowance renews each month."}
        </Text>
      ) : !products ? (
        <ActivityIndicator accessibilityLabel="Loading extra AI credits" color={theme.accent} />
      ) : (
        products.map((product) => (
          <PrimaryButton
            key={product.productId}
            label={`${product.title} · ${product.priceString}`}
            busy={busy === product.productId}
            disabled={Boolean(busy) && busy !== product.productId}
            accessibilityHint={`One-time purchase of ${product.priceString}. It doesn't change your subscription or start a new one.`}
            onPress={() => void buy(product)}
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

const s = StyleSheet.create({
  group: { gap: spacing.md },
  title: { ...typography.sectionTitle },
  detail: { fontSize: 16, lineHeight: 24 },
});
