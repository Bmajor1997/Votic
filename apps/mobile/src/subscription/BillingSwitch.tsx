import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SecondaryButton } from "../onboarding/components";
import { useVoticTheme } from "../theme/ThemeProvider";
import { has_access } from "./entitlement";
import { price_label } from "./offerText";
import { other_billing_plan } from "./paywallPresentation";
import { store_deadline } from "./storeDeadline";
import { useSubscription } from "./SubscriptionProvider";
import { SubscriptionPlan } from "./subscriptionTypes";

/**
 * Lets a subscriber move between monthly and annual billing through the store's change flow, which replaces the
 * subscription instead of adding a second one. Votic Plus features and the monthly AI allowance stay the same;
 * the server keeps the current month's allowance through the switch, so nothing is granted twice.
 */
export function BillingSwitch() {
  const { theme } = useVoticTheme();
  const subscription = useSubscription();
  const { service, entitlement } = subscription;
  const [target, setTarget] = useState<SubscriptionPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const alive = useRef(true);
  const eligible = has_access(entitlement.status) && Boolean(service.changePlan && entitlement.productId);
  useEffect(() => {
    alive.current = true;
    if (!eligible) return;
    void store_deadline(service.getPlans())
      .then((plans) => {
        if (alive.current) setTarget(other_billing_plan(plans, entitlement.productId));
      })
      .catch(() => {});
    return () => {
      alive.current = false;
    };
  }, [eligible, service, entitlement.productId]);
  if (!eligible || !target) return null;
  const annual = target.billingPeriod?.unit === "year";
  async function change(plan: SubscriptionPlan) {
    setBusy(true);
    setMessage("");
    const outcome = await service.changePlan!(plan.id, entitlement.productId!).catch(() => ({
      kind: "failed" as const,
      message: "The store couldn't change your plan. Please try again.",
    }));
    if (!alive.current) return;
    setBusy(false);
    if (outcome.kind === "purchased") {
      subscription.setEntitlement(outcome.entitlement);
      setMessage(
        annual
          ? "You're on annual billing. Your monthly AI allowance continues as before."
          : "Monthly billing starts when your current annual period ends.",
      );
    } else if (outcome.kind === "pending")
      setMessage("Your plan change is waiting for the store to approve it.");
    else if (outcome.kind === "failed") setMessage(outcome.message);
  }
  return (
    <View style={s.content}>
      <Text style={[s.detail, { color: theme.mutedText }]}>
        {annual
          ? `Annual billing is ${price_label(target)}. The store shows any credit for your current month before you confirm.`
          : `Monthly billing is ${price_label(target)}. It starts when your current annual period ends.`}
      </Text>
      <SecondaryButton
        label={annual ? "Switch to annual billing" : "Switch to monthly billing"}
        busy={busy}
        disabled={busy}
        onPress={() => void change(target)}
      />
      {message ? (
        <Text accessibilityLiveRegion="polite" style={[s.detail, { color: theme.text }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  content: { gap: 8, paddingVertical: 8 },
  detail: { fontSize: 14, lineHeight: 21 },
});
