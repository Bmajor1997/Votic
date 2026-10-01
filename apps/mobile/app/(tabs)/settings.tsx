import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { authErrorMessage } from "../../src/auth/authErrors";
import { removeAccountSetup } from "../../src/onboarding/onboardingStorage";
import { PersonalizationFlow } from "../../src/onboarding/PersonalizationFlow";
import { EXPLANATION_STYLES, useVoticPurpose } from "../../src/personalization/PurposeProvider";
import { hasAccess } from "../../src/subscription/entitlement";
import { useSubscription } from "../../src/subscription/SubscriptionProvider";
import { Entitlement } from "../../src/subscription/subscriptionTypes";
import { LearnVoticSettings } from "../../src/walkthrough/LearnVoticSettings";
import { Screen } from "../../src/components/Screen";
import { spacing, typography } from "../../src/design/tokens";
import {
  TextSize,
  ReadingSpacing,
  useAccessibilityPreferences,
} from "../../src/accessibility/AccessibilityProvider";
import { accentColors, AccentName, AppearanceMode, useVoticTheme } from "../../src/theme/ThemeProvider";
const colors: AccentName[] = [
  "orange",
  "blue",
  "purple",
  "red",
  "teal",
  "emerald",
  "indigo",
  "rose",
  "amber",
];
const appearances: AppearanceMode[] = ["light", "dark", "sepia"];
const textSizes: TextSize[] = ["default", "large", "extra-large"];
const spacings: ReadingSpacing[] = ["compact", "default", "extra"];
export default function Settings() {
  const { accentName, setAccentName, appearanceMode, setAppearanceMode, theme } = useVoticTheme();
  const a = useAccessibilityPreferences();
  const personalization = useVoticPurpose();
  const auth = useAuth();
  const subscription = useSubscription();
  const [editingPersonalization, setEditingPersonalization] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");
  async function restore() {
    setRestoreMessage("");
    const restored = await subscription.service.restore();
    if (hasAccess(restored.status)) {
      subscription.setEntitlement(restored);
      setRestoreMessage("Your Votic Premium subscription is active.");
    } else if (restored.status === "unknown")
      setRestoreMessage("Votic couldn't reach the store. Check your connection and try again.");
    else setRestoreMessage("No active Votic Premium subscription was found for this store account.");
  }
  function confirmSignOut() {
    Alert.alert("Sign out of Votic?", "Your documents and notes stay on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", onPress: () => void auth.signOut() },
    ]);
  }
  function confirmDelete() {
    Alert.alert(
      "Delete your Votic account?",
      "This permanently deletes your account. Documents and notes on this device are not removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            const uid = auth.user?.uid;
            void auth
              .deleteAccount()
              .then(() => (uid ? removeAccountSetup(uid) : undefined))
              .catch((error) => Alert.alert("Couldn't delete account", authErrorMessage(error)));
          },
        },
      ],
    );
  }
  const segmented = (
    values: string[],
    selected: string,
    onSelect: (v: any) => void,
    label: (v: string) => string = (v) => v,
  ) => (
    <View style={[s.segmented, { backgroundColor: theme.surfaceMuted }]}>
      {values.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === v }}
          onPress={() => onSelect(v)}
          style={[s.segment, selected === v && { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Text style={[s.segmentText, { color: selected === v ? theme.text : theme.mutedText }]}>
            {label(v)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  return (
    <Screen title="Settings">
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Appearance</Text>
        <Text style={[s.label, { color: theme.mutedText }]}>MODE</Text>
        {segmented(appearances, appearanceMode, setAppearanceMode, (v) => v[0].toUpperCase() + v.slice(1))}
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Accent</Text>
        <Text style={[s.body, { color: theme.mutedText }]}>
          Used for active controls, progress, and reading highlights.
        </Text>
        <View style={s.swatches}>
          {colors.map((v) => (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityState={{ checked: accentName === v }}
              accessibilityLabel={v + " accent color"}
              onPress={() => setAccentName(v)}
              style={[s.swatchTouch, accentName === v && { borderColor: theme.text }]}
            >
              <View style={[s.swatch, { backgroundColor: accentColors[v], borderColor: accentColors[v] }]}>
                {accentName === v ? <Text style={s.swatchCheck}>✓</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Reading</Text>
        <Text style={[s.label, { color: theme.mutedText }]}>TEXT SIZE</Text>
        {segmented(textSizes, a.textSize, a.setTextSize, (v) =>
          v === "extra-large" ? "Extra large" : v[0].toUpperCase() + v.slice(1),
        )}
        <Text style={[s.label, { color: theme.mutedText }]}>SPACING</Text>
        {segmented(spacings, a.readingSpacing, a.setReadingSpacing, (v) =>
          v === "extra" ? "Extra" : v === "compact" ? "Compact" : "Default",
        )}
        <View style={[s.settingRow, { borderTopColor: theme.border }]}>
          <View style={s.settingCopy}>
            <Text style={[s.settingTitle, { color: theme.text }]}>Reduce motion</Text>
            <Text style={[s.settingDetail, { color: theme.mutedText }]}>
              Minimize Reader and sheet animations.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Reduce motion"
            value={a.reduceMotion}
            onValueChange={a.setReduceMotion}
          />
        </View>
        <View style={[s.settingRow, { borderTopColor: theme.border }]}>
          <View style={s.settingCopy}>
            <Text style={[s.settingTitle, { color: theme.text }]}>Emphasize current word</Text>
            <Text style={[s.settingDetail, { color: theme.mutedText }]}>
              Make the spoken word slightly larger and bolder.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Emphasize current word"
            value={a.wordEmphasis}
            onValueChange={a.setWordEmphasis}
          />
        </View>
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Personalization</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Personalization"
          accessibilityHint="Change your answers about what Votic should help you with"
          onPress={() => setEditingPersonalization(true)}
          style={[s.tourButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <Ionicons name="options-outline" size={22} color={theme.accent} />
          <View style={s.settingCopy}>
            <Text style={[s.settingTitle, { color: theme.text }]}>Your answers</Text>
            <Text style={[s.settingDetail, { color: theme.mutedText }]}>
              Change what Votic suggests and how it helps you.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
        </Pressable>
        <Modal
          visible={editingPersonalization}
          animationType={a.reduceMotion ? "none" : "slide"}
          onRequestClose={() => setEditingPersonalization(false)}
        >
          {editingPersonalization ? (
            <PersonalizationFlow mode="edit" onClose={() => setEditingPersonalization(false)} />
          ) : null}
        </Modal>
        <Text style={[s.label, { color: theme.mutedText }]}>EXPLANATIONS</Text>
        {segmented(
          EXPLANATION_STYLES.map((item) => item.value),
          personalization.explanationStyle,
          personalization.setExplanationStyle,
          (v) => (v === "adaptive" ? "Adapt" : v[0].toUpperCase() + v.slice(1)),
        )}
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Help</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Statistics"
          accessibilityHint="Reading and listening time, activity, and insights"
          onPress={() => router.push("/statistics")}
          style={[s.tourButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <Ionicons name="stats-chart-outline" size={22} color={theme.accent} />
          <View style={s.settingCopy}>
            <Text style={[s.settingTitle, { color: theme.text }]}>Statistics</Text>
            <Text style={[s.settingDetail, { color: theme.mutedText }]}>
              Reading and listening time, activity, and insights.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
        </Pressable>
        <LearnVoticSettings />
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Account</Text>
        {auth.user?.email ? (
          <Text style={[s.body, { color: theme.mutedText }]}>Signed in as {auth.user.email}</Text>
        ) : null}
        {!subscription.service.unavailableReason ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage subscription"
              accessibilityHint={subscriptionStatus(subscription.entitlement)}
              onPress={() =>
                void Linking.openURL(subscription.entitlement.managementUrl || STORE_SUBSCRIPTIONS_URL)
              }
              style={[s.tourButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <Ionicons name="card-outline" size={22} color={theme.accent} />
              <View style={s.settingCopy}>
                <Text style={[s.settingTitle, { color: theme.text }]}>Votic Premium</Text>
                <Text style={[s.settingDetail, { color: theme.mutedText }]}>
                  {subscriptionStatus(subscription.entitlement)}
                </Text>
              </View>
              <Ionicons name="open-outline" size={20} color={theme.mutedText} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restore purchases"
              onPress={() => void restore()}
              style={[s.accountButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <Ionicons name="refresh-outline" size={22} color={theme.text} />
              <Text style={[s.settingTitle, { color: theme.text }]}>Restore purchases</Text>
            </Pressable>
            {restoreMessage ? (
              <Text accessibilityLiveRegion="polite" style={[s.settingDetail, { color: theme.mutedText }]}>
                {restoreMessage}
              </Text>
            ) : null}
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={confirmSignOut}
          style={[s.accountButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <Ionicons name="log-out-outline" size={22} color={theme.text} />
          <Text style={[s.settingTitle, { color: theme.text }]}>Sign out</Text>
        </Pressable>
        {auth.configured ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            onPress={confirmDelete}
            style={[s.accountButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <Ionicons name="trash-outline" size={22} color="#DC2626" />
            <Text style={[s.settingTitle, { color: "#DC2626" }]}>Delete account</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
const STORE_SUBSCRIPTIONS_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";

function formatDate(time: number) {
  return new Date(time).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/** The subscription as the store reports it, in plain words. */
export function subscriptionStatus(entitlement: Entitlement) {
  const until = entitlement.expiresAt ? formatDate(entitlement.expiresAt) : null;
  switch (entitlement.status) {
    case "trial":
      return until ? `Free trial · ends ${until}` : "Free trial";
    case "active":
      return until ? `Active · renews ${until}` : "Active";
    case "cancelled-active":
      return until ? `Cancelled · access until ${until}` : "Cancelled · access until the end of this period";
    case "billing-issue":
      return "There's a problem with your payment. Update it in your store account to keep Votic Premium.";
    case "expired":
      return "Ended";
    case "none":
      return "Not subscribed";
    default:
      return "Status unavailable right now";
  }
}

const s = StyleSheet.create({
  section: { gap: spacing.md },
  h: { ...typography.sectionTitle },
  body: { ...typography.body },
  label: { ...typography.eyebrow, marginTop: spacing.xs },
  divider: { height: 1, marginVertical: spacing.xs },
  segmented: { flexDirection: "row", padding: 3, borderRadius: 12, gap: 2 },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  segmentText: { fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  swatchTouch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchCheck: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", lineHeight: 18 },
  settingRow: {
    minHeight: 68,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  tourButton: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  accountButton: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { fontSize: 16, fontWeight: "700" },
  settingDetail: { fontSize: 13, lineHeight: 18 },
});
