import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { radii, spacing } from "../design/tokens";
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
          stacked={!sideBySide}
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
  stacked,
  disabled,
  onPress,
}: {
  plan: SubscriptionPlan;
  plans: SubscriptionPlan[];
  active: boolean;
  stacked: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  // "Save 33%" and "$6.67/month" only when both store prices are known in the same currency.
  const value = annual_value(plan, plans);
  const per = billing_period_label(plan.billingPeriod);
  // The same name on screen and for screen readers.
  const name =
    plan.billingPeriod?.unit === "year" && plan.billingPeriod.count === 1 ? "Annual" : plan_name(plan);
  const label = [
    name,
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
      style={[
        s.option,
        stacked && s.stackedOption,
        {
          backgroundColor: active ? theme.sentenceHighlight : theme.surface,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      {value ? (
        <View style={[s.badge, { backgroundColor: theme.accent }]}>
          <Text style={[s.badgeText, { color: theme.onAccent }]}>Save {value.savings}%</Text>
        </View>
      ) : null}
      <View style={s.top}>
        <Text style={[p.benefitTitle, s.name, { color: theme.text }]}>{name}</Text>
        <Ionicons
          name={active ? "radio-button-on" : "radio-button-off"}
          size={22}
          color={active ? theme.accentText : theme.mutedText}
        />
      </View>
      <Text style={[s.price, { color: theme.text }]}>
        {plan.priceString}
        <Text style={[s.per, { color: theme.mutedText }]}>{per ? `/${per}` : ""}</Text>
      </Text>
      {value ? (
        <Text style={[s.equivalent, { color: theme.mutedText }]}>About {value.equivalent}/month</Text>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  // Room above the cards for the savings pill that sits on the annual card's top edge.
  row: { flexDirection: "row", gap: spacing.sm, paddingTop: 10 },
  stack: { flexDirection: "column", gap: 16 },
  option: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    minHeight: 72,
    minWidth: 0,
  },
  name: { flex: 1, fontWeight: "800" },
  stackedOption: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  price: { fontWeight: "800", fontSize: 22, lineHeight: 28, flexShrink: 1 },
  equivalent: { fontSize: 12, lineHeight: 17, flexShrink: 1 },
  per: { fontSize: 14, lineHeight: 22, letterSpacing: 0, fontWeight: "400" },
  badge: {
    position: "absolute",
    top: -11,
    right: 10,
    zIndex: 1,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  badgeText: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
});
