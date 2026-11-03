import { StyleSheet, Text, View } from "react-native";
import { editorial } from "../design/editorial";
import { spacing } from "../design/tokens";
import { PrimaryButton } from "../onboarding/components";
import { useVoticTheme } from "../theme/ThemeProvider";
import { paywallStyles as p } from "./paywallStyles";
import { founder_availability } from "./founderText";
import { FounderOffer, FounderProduct } from "./subscriptionTypes";

/**
 * The founder lifetime offer, shown only to beta testers the server says are still eligible. One payment,
 * Votic Plus for good. The price and title come from the store; access starts only when the store confirms it.
 */
export function FounderOfferCard({
  offer,
  product,
  busy,
  disabled,
  onBuy,
}: {
  offer: FounderOffer;
  product: FounderProduct;
  busy: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  const { theme } = useVoticTheme();
  const availability = founder_availability(offer);
  return (
    <View
      testID="founder-offer"
      style={[s.card, { backgroundColor: theme.sentenceHighlight, borderColor: theme.accent }]}
    >
      <View style={[s.badge, { backgroundColor: theme.brandTint }]}>
        <Text style={[s.badgeText, { color: theme.accentText }]}>For beta testers</Text>
      </View>
      <Text accessibilityRole="header" style={[p.sectionTitle, { color: theme.text }]}>
        Founder lifetime
      </Text>
      <Text style={[s.price, { color: theme.text }]}>
        {product.priceString}
        <Text style={s.once}> once</Text>
      </Text>
      <Text style={[p.detail, { color: theme.text }]}>
        Votic Plus for good, with one payment and no subscription. A thank-you for helping test Votic.
      </Text>
      <Text style={[p.detail, { color: theme.mutedText }]}>
        Includes the same monthly AI allowance as Votic Plus.
      </Text>
      <Text accessibilityLiveRegion="polite" style={[p.detail, { color: theme.text, fontWeight: "700" }]}>
        {availability}
      </Text>
      <PrimaryButton
        label={`Become a founder for ${product.priceString}`}
        busy={busy}
        disabled={disabled}
        accessibilityHint={`One-time payment of ${product.priceString}. ${availability}.`}
        onPress={onBuy}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 22, padding: spacing.lg, gap: spacing.sm },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: "800" },
  price: { ...editorial, fontSize: 30, lineHeight: 38 },
  once: { fontSize: 16, lineHeight: 22, letterSpacing: 0 },
});
