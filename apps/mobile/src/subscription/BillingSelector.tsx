import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { editorial } from "../design/editorial";
import { radii, spacing } from "../design/tokens";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { billing_period_label, plan_name } from "./offerText";
import { annual_value } from "./paywallPresentation";
import { paywallStyles as p } from "./paywallStyles";
import { SubscriptionPlan } from "./subscriptionTypes";

/**
 * Monthly or annual Votic Plus. Both cards show the store's own price; the annual card adds the savings and the
 * monthly equivalent calculated from those prices, never from fixed amounts.
 */
export function BillingSelector({
  plans,
  selectedId,
  onSelect,
  disabled,
}: {
  plans: SubscriptionPlan[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const { width, fontScale } = useWindowDimensions();
  const sideBySide = width >= 360 && fontScale < 1.3;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Billing" style={[s.row, !sideBySide && s.stack]}>
      {plans.map((plan) => (
        <BillingOption
          key={plan.id}
          plan={plan}
          plans={plans}
          active={plan.id === selectedId}
          disabled={disabled}
          onPress={() => onSelect(plan.id)}
        />
      ))}
    </View>
  );
}

function BillingOption({
  plan,
  plans,
  active,
  disabled,
  onPress,
}: {
  plan: SubscriptionPlan;
  plans: SubscriptionPlan[];
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  // "Save 33%" and "$6.67/month" only when both store prices are known in the same currency.
  const value = annual_value(plan, plans);
  const per = billing_period_label(plan.billingPeriod);
  const label = [
    plan_name(plan),
    per ? `${plan.priceString} per ${per}` : plan.priceString,
    value ? `equivalent to ${value.equivalent} a month. ${value.comparison}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.option,
        {
          backgroundColor: active ? theme.sentenceHighlight : theme.surface,
          borderColor: active ? theme.accent : theme.border,
        },
        !reduceMotion && pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={s.top}>
        <Text style={[p.benefitTitle, { color: theme.text }]}>{plan_name(plan)}</Text>
        <Ionicons
          name={active ? "radio-button-on" : "radio-button-off"}
          size={22}
          color={active ? theme.accentText : theme.mutedText}
        />
      </View>
      <Text style={[s.price, { color: theme.text }]}>
        {plan.priceString}
        <Text style={s.per}>{per ? `/${per}` : ""}</Text>
      </Text>
      {value ? (
        <>
          <Text style={[p.detail, { color: theme.mutedText }]}>About {value.equivalent}/month</Text>
          <View style={[s.badge, { backgroundColor: theme.brandTint }]}>
            <Text style={[s.badgeText, { color: theme.accentText }]}>Save {value.savings}%</Text>
          </View>
        </>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md },
  stack: { flexDirection: "column" },
  option: { flex: 1, borderWidth: 2, borderRadius: 22, padding: spacing.lg, gap: spacing.xs, minHeight: 48 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  price: { ...editorial, fontSize: 26, lineHeight: 34 },
  per: { fontSize: 14, lineHeight: 22, letterSpacing: 0 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  badgeText: { fontSize: 12, lineHeight: 18, fontWeight: "800" },
});
