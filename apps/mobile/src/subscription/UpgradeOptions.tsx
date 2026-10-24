import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { subscription_options, SubscriptionOptions } from "../api/voticApi";
import { useAuth } from "../auth/AuthProvider";
import { PrimaryButton, SecondaryButton } from "../onboarding/components";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useSubscription } from "./SubscriptionProvider";
import { price_label } from "./offerText";
import { STORE_SUBSCRIPTIONS_URL, subscription_status } from "./subscriptionStatus";
import { store_deadline } from "./storeDeadline";
import { SubscriptionPlan } from "./subscriptionTypes";
import { upgrade_offers } from "./upgradeOffers";

type Loaded = { options: SubscriptionOptions; plans: SubscriptionPlan[] };

/** Store-managed replacement: never purchases a second subscription alongside the existing one. */
export function UpgradeOptions() {
  const { user, homeEntrance } = useAuth();
  // A new account remounts all async state before it can show another account's offers.
  return <AccountUpgradeOptions key={`${user?.uid ?? "signed-out"}:${homeEntrance.key()}`} />;
}
function AccountUpgradeOptions() {
  const { theme } = useVoticTheme();
  const subscription = useSubscription();
  const { service, entitlement } = subscription;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const alive = useRef(true);
  const openingRef = useRef(false);
  const visitedStore = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const reload = useCallback(() => {
    setLoaded(null);
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);
  useEffect(() => {
    if (service.unavailableReason) return;
    let current = true;
    void subscription_options()
      .then(async (options) => {
        const ids = options.upgrades.map((item) => item.productId);
        const plans = ids.length
          ? await store_deadline(service.getUpgradePlans ? service.getUpgradePlans(ids) : service.getPlans())
          : [];
        return { options, plans };
      })
      .then(
        ({ options, plans }) => {
          if (current) setLoaded({ options, plans });
        },
        () => {
          if (current) setFailed(true);
        },
      );
    return () => {
      current = false;
    };
  }, [service, attempt]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !visitedStore.current) return;
      visitedStore.current = false;
      setMessage("Checking your subscription. A change takes effect after the store confirms it.");
      void subscription
        .refresh()
        .then((result) => {
          if (alive.current)
            setMessage(
              result.status === "unknown"
                ? "Votic could not confirm your subscription yet. Please refresh again shortly."
                : "Your subscription status has been refreshed. Store changes can take a little time to appear.",
            );
        })
        .catch(() => {
          if (alive.current)
            setMessage("Votic could not confirm your subscription yet. Please refresh again shortly.");
        });
      reload();
    });
    return () => listener.remove();
  }, [subscription, reload]);
  async function open_store() {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setMessage("");
    try {
      visitedStore.current = true;
      await Linking.openURL(entitlement.managementUrl || STORE_SUBSCRIPTIONS_URL);
    } catch {
      visitedStore.current = false;
      if (alive.current) setMessage("The store could not open. Please try again.");
    } finally {
      openingRef.current = false;
      if (alive.current) setOpening(false);
    }
  }
  const offers = loaded ? upgrade_offers(loaded.options, loaded.plans, Platform.OS) : [];
  return (
    <View style={s.content}>
      <Text style={[s.title, { color: theme.text }]} accessibilityRole="header">
        Your subscription
      </Text>
      <Text style={[s.detail, { color: theme.mutedText }]}>{subscription_status(entitlement)}</Text>
      {loaded?.options.current ? (
        <Text style={[s.detail, { color: theme.text }]}>Current plan: {loaded.options.current.name}</Text>
      ) : null}
      {service.unavailableReason ? (
        <Text style={[s.detail, { color: theme.text }]}>
          Subscription changes need a store build of Votic.
        </Text>
      ) : failed ? (
        <>
          <Text accessibilityRole="alert" style={[s.detail, { color: theme.text }]}>
            Votic could not load upgrade options. You can still manage your subscription in the store.
          </Text>
          <SecondaryButton label="Try again" onPress={reload} />
        </>
      ) : !loaded ? (
        <ActivityIndicator accessibilityLabel="Loading subscription options" color={theme.accent} />
      ) : offers.length ? (
        <>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            Available plans
          </Text>
          {offers.map((offer) => (
            <View
              key={offer.plan.id}
              style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[s.title, { color: theme.text }]}>{offer.name}</Text>
              <Text style={[s.detail, { color: theme.text }]}>{price_label(offer.plan)}</Text>
              <Text style={[s.detail, { color: theme.mutedText }]}>
                {offer.capacityMultiplier
                  ? `${offer.capacityMultiplier.toLocaleString()}× your current monthly AI capacity.`
                  : "A higher monthly AI allowance than your current plan."}{" "}
                Daily and service limits still apply.
              </Text>
              <PrimaryButton
                label={`Review upgrade to ${offer.name}`}
                disabled={opening}
                onPress={() => void open_store()}
              />
            </View>
          ))}
          <Text style={[s.detail, { color: theme.mutedText }]}>
            Choose the new plan in your store subscription settings. The store shows the final price, any
            charge or credit, renewal terms, and when the change takes effect before you confirm. Nothing
            changes until then.
          </Text>
        </>
      ) : (
        <Text style={[s.detail, { color: theme.text }]}>
          No higher-capacity monthly plan is available here right now. You can still manage your subscription
          in the store.
        </Text>
      )}
      {!service.unavailableReason ? (
        <SecondaryButton
          label="Manage subscription in store"
          disabled={opening}
          onPress={() => void open_store()}
        />
      ) : null}
      {!service.unavailableReason ? (
        <SecondaryButton label="Refresh subscription options" onPress={reload} />
      ) : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={[s.detail, { color: theme.text }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  content: { gap: 16 },
  title: { fontSize: 21, fontWeight: "700", flexShrink: 1 },
  detail: { fontSize: 16, lineHeight: 24 },
  card: { gap: 12, padding: 18, borderWidth: 1, borderRadius: 20 },
});
