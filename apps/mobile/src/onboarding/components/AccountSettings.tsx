import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useRef, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { AuthError } from "../../auth/authTypes";
import { spacing, typography } from "../../design/tokens";
import { hasAccess } from "../../subscription/entitlement";
import { Entitlement } from "../../subscription/subscriptionTypes";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { useAccount } from "../AccountProvider";
import { PersonalizeScreen } from "../screens/PersonalizeScreen";
import { Notice, OnboardingScreen, PrimaryButton, TextField, Title } from "./OnboardingUI";

const STORE_SUBSCRIPTIONS_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";

function formatDate(time: number) {
  return new Date(time).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function subscriptionStatusText(entitlement: Entitlement, grandfathered: boolean) {
  const until = entitlement.expiresAt ? formatDate(entitlement.expiresAt) : null;
  switch (entitlement.status) {
    case "trial":
      return until ? `Free trial · ends ${until}` : "Free trial";
    case "active":
      return until ? `Active · renews ${until}` : "Active";
    case "cancelled-active":
      return until ? `Cancelled · access until ${until}` : "Cancelled · access until the end of this period";
    case "billing-issue":
      return "There's a problem with your payment. Update it in your store account to keep Votic.";
    case "expired":
      return "Ended";
    case "none":
      return grandfathered ? "Included with your existing Votic app" : "No subscription";
    default:
      return grandfathered ? "Included with your existing Votic app" : "Status unavailable";
  }
}

/** Account, personalization, and subscription controls for the Settings screen. */
export function AccountSettings() {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const account = useAccount();
  const { user, entitlement, services, deviceHistory } = account;
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");
  if (!user) return null;
  const subscriptionsAvailable = !services.subscriptions.unavailableReason;

  function confirmSignOut() {
    Alert.alert("Sign out of Votic?", "Your documents and notes stay on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => void account.signOut() },
    ]);
  }
  async function restore() {
    setRestoreMessage("");
    const restored = await services.subscriptions.restore();
    if (hasAccess(restored.status)) {
      account.setEntitlement(restored);
      setRestoreMessage("Your subscription was restored.");
    } else setRestoreMessage("No active Votic subscription was found for this store account.");
  }

  return (
    <View style={s.section}>
      <Text style={[s.h, { color: theme.text }]}>Account</Text>
      <Text style={[s.detail, { color: theme.mutedText }]}>
        {user.firstName ? `${user.firstName} · ${user.email}` : user.email}
      </Text>
      <Row
        icon="options-outline"
        title="Personalization"
        detail="Change how Votic helps you."
        onPress={() => setEditing(true)}
      />
      {subscriptionsAvailable ? (
        <>
          <Row
            icon="card-outline"
            title="Manage Subscription"
            detail={subscriptionStatusText(entitlement, deviceHistory === "existing")}
            onPress={() => void Linking.openURL(entitlement.managementUrl || STORE_SUBSCRIPTIONS_URL)}
          />
          <Row
            icon="refresh-outline"
            title="Restore Purchases"
            detail="Use a subscription you already have."
            onPress={() => void restore()}
          />
          {restoreMessage ? <Notice>{restoreMessage}</Notice> : null}
        </>
      ) : null}
      <Row
        icon="log-out-outline"
        title="Sign Out"
        detail="Your documents and notes stay on this device."
        onPress={confirmSignOut}
      />
      <Row
        icon="trash-outline"
        title="Delete Account"
        detail="Permanently delete your Votic account."
        onPress={() => setDeleting(true)}
      />
      <Modal
        visible={editing}
        animationType={reduceMotion ? "none" : "slide"}
        onRequestClose={() => setEditing(false)}
      >
        <PersonalizeScreen mode="edit" onClose={() => setEditing(false)} />
      </Modal>
      <Modal
        visible={deleting}
        animationType={reduceMotion ? "none" : "slide"}
        onRequestClose={() => setDeleting(false)}
      >
        <DeleteAccount
          onClose={() => setDeleting(false)}
          storeManaged={subscriptionsAvailable && hasAccess(entitlement.status)}
        />
      </Modal>
    </View>
  );
}

function DeleteAccount({ onClose, storeManaged }: { onClose: () => void; storeManaged: boolean }) {
  const { deleteAccount } = useAccount();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  async function submit() {
    if (inFlight.current) return;
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      await deleteAccount(password);
      // Signed out now; the entry gate returns to Welcome.
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : "Something went wrong. Please try again.");
      setPassword("");
      inFlight.current = false;
      setSubmitting(false);
    }
  }
  return (
    <OnboardingScreen
      onBack={onClose}
      backLabel="Cancel"
      footer={<PrimaryButton label="Delete My Account" onPress={() => void submit()} loading={submitting} />}
    >
      <Title subtitle="This permanently deletes your Votic account and can't be undone. Documents and notes saved on this device stay on this device.">
        Delete your account?
      </Title>
      {storeManaged ? (
        <Notice>
          {`Deleting your account doesn't cancel your subscription. Cancel it first in your ${Platform.OS === "ios" ? "App Store" : "Google Play"} subscription settings.`}
        </Notice>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <TextField
        label="Password"
        secure
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        editable={!submitting}
      />
    </OnboardingScreen>
  );
}

function Row({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      style={[s.row, { borderColor: theme.border, backgroundColor: theme.surface }]}
    >
      <Ionicons name={icon} size={22} color={theme.accent} />
      <View style={s.copy}>
        <Text style={[s.title, { color: theme.text }]}>{title}</Text>
        <Text style={[s.detail, { color: theme.mutedText }]}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  section: { gap: spacing.md },
  h: { ...typography.sectionTitle },
  row: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: "700" },
  detail: { fontSize: 13, lineHeight: 18 },
});
