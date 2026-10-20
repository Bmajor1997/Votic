import { useAccountData } from "../storage/AccountDataProvider";
import { router } from "expo-router";
import { DiagnosticsSettings } from "./DiagnosticsSettings";
import { account_deletion_pending } from "../storage/accountDeletion";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, Ref, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useAuth } from "../auth/AuthProvider";
import { auth_error_message } from "../auth/authErrors";
import { Card } from "../components/Card";
import { controlSizes, radii, spacing, typography } from "../design/tokens";
import { has_access } from "../subscription/entitlement";
import { useSubscription } from "../subscription/SubscriptionProvider";
import { STORE_SUBSCRIPTIONS_URL, subscription_status } from "../subscription/subscriptionStatus";
import { useVoticTheme } from "../theme/ThemeProvider";

type Step = "sign-out" | "deletion-info" | "deletion-final" | "recover-library";

/** Account deletion coordinates local erasure, private backend data, billing profile and Firebase. */
export function AccountSettings() {
  const auth = useAuth();
  const accountData = useAccountData();
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const heading = useRef<Text>(null);
  const signOutRow = useRef<View>(null);
  const deleteRow = useRef<View>(null);
  const destructive = theme.isDark ? "#FFB4B4" : "#B91C1C";
  function focus(target: Text | View | null) {
    // findNodeHandle isn't supported on web, where the browser keeps focus on its own.
    const handle = target && Platform.OS !== "web" ? findNodeHandle(target) : null;
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }
  useEffect(() => {
    if (!step) return;
    const frame = requestAnimationFrame(() => focus(heading.current));
    return () => cancelAnimationFrame(frame);
  }, [step]);
  function open(next: Step) {
    if (pending.current || !auth.user) return;
    setError(null);
    setStep(next);
  }
  function close() {
    if (pending.current) return;
    const target = step === "sign-out" ? signOutRow.current : deleteRow.current;
    setStep(null);
    setError(null);
    requestAnimationFrame(() => focus(target));
  }
  async function execute(action: "sign-out" | "delete" | "recover") {
    if (pending.current || !auth.user) return;
    if (action === "recover" && step !== "recover-library") return;
    if (action === "delete" && (step !== "deletion-final" || !auth.configured)) return;
    if (action === "sign-out" && step !== "sign-out") return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === "recover") await accountData.recover();
      else if (action === "sign-out") await auth.signOut();
      else {
        await accountData.deleteAccount();
      }
      setStep(null);
    } catch (failure) {
      if (action === "delete" && auth.user && (await account_deletion_pending(auth.user.uid))) {
        setStep(null); // The account session owns the persistent retry screen after cleanup starts.
        return;
      }
      const code = (failure as { code?: string } | null)?.code;
      const message =
        action === "recover"
          ? "Votic could not recover your older library. Its backup is unchanged. Please try again."
          : code === "auth/requires-recent-login"
            ? "Your account has not been deleted. For your security, cancel this request, sign out, and sign back in using your usual sign-in method. Then return to Settings to delete your account."
            : code === "auth/network-request-failed" || code === "auth/too-many-requests"
              ? auth_error_message(failure)
              : action === "delete"
                ? "Votic couldn't delete your account. Please try again. If this continues, contact Votic support."
                : "Votic couldn't sign you out. Please try again.";
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const final = step === "deletion-final";
  const signingOut = step === "sign-out";
  const recovering = step === "recover-library";
  const title = recovering
    ? "Recover your older library?"
    : signingOut
      ? "Sign out of Votic?"
      : final
        ? "Permanently delete account?"
        : "Before you delete your account";
  return (
    <>
      <View
        style={s.section}
        accessibilityElementsHidden={step !== null}
        importantForAccessibility={step ? "no-hide-descendants" : "auto"}
      >
        <Text accessibilityRole="header" style={[s.heading, { color: theme.text }]}>
          Account
        </Text>
        <Card>
          <View style={s.identity}>
            <View style={[s.avatar, { backgroundColor: theme.brandTint }]}>
              <Ionicons name="person-outline" size={26} color={theme.accentText} accessible={false} />
            </View>
            <View style={s.copy}>
              <Text style={[s.title, { color: theme.text }]}>
                {auth.user ? "Your Votic account" : "Not signed in"}
              </Text>
              <Text style={[s.detail, { color: theme.mutedText }]}>
                {auth.user?.email ??
                  auth.user?.displayName ??
                  (auth.user
                    ? auth.configured
                      ? "Signed-in session"
                      : "Development preview"
                    : "Sign in to manage account access.")}
              </Text>
            </View>
          </View>
        </Card>
        {auth.user ? (
          <AccountRow
            label="Library backup & restore"
            detail="Save your library or restore a backup, even without an active membership."
            hint="Opens library backup and restore"
            icon="download-outline"
            onPress={() => router.push("/library-backup")}
          />
        ) : null}
        <DiagnosticsSettings />
        {auth.user && accountData.canRecover ? (
          <AccountRow
            label="Recover older device library"
            detail="Move your documents, notes, collections, and activity from an older Votic version into this account."
            hint="Opens a confirmation before assigning the older library to this account"
            icon="archive-outline"
            onPress={() => open("recover-library")}
          />
        ) : null}
        {auth.user ? <PremiumRows /> : null}
        {auth.user ? (
          <>
            <Text accessibilityRole="header" style={[s.label, { color: theme.mutedText }]}>
              ACCOUNT ACCESS
            </Text>
            <AccountRow
              ref={signOutRow}
              label="Sign out"
              detail="End this session. Your account stays active, so you can sign back in later."
              hint="Shows a confirmation. Does not delete your account, local documents, or notes"
              icon="log-out-outline"
              onPress={() => open("sign-out")}
            />
            <Text style={[s.detail, { color: theme.mutedText }]}>
              Signing out does not delete documents or notes stored on this device.
            </Text>
            {auth.configured ? (
              <View style={[s.deletion, { borderTopColor: theme.border }]}>
                <Text accessibilityRole="header" style={[s.label, { color: theme.mutedText }]}>
                  ACCOUNT DELETION
                </Text>
                <AccountRow
                  ref={deleteRow}
                  label="Delete account"
                  detail="Permanently delete your Votic account and sign-in. This cannot be undone."
                  hint="Destructive action. Opens an explanation; two confirmation steps are required before deletion"
                  icon="trash-outline"
                  onPress={() => open("deletion-info")}
                  danger
                />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      <Modal
        testID="account-confirmation"
        visible={step !== null}
        animationType={reduceMotion ? "none" : "fade"}
        onRequestClose={close}
        onShow={() => focus(heading.current)}
      >
        <SafeAreaView accessibilityViewIsModal style={[s.safe, { backgroundColor: theme.background }]}>
          <ScrollView contentContainerStyle={s.content}>
            <Text style={[s.label, { color: final ? destructive : theme.accentText }]}>
              {signingOut
                ? "ACCOUNT ACCESS"
                : final
                  ? "FINAL CONFIRMATION · STEP 2 OF 2"
                  : "ACCOUNT DELETION · STEP 1 OF 2"}
            </Text>
            <Text ref={heading} accessibilityRole="header" style={[s.modalTitle, { color: theme.text }]}>
              {title}
            </Text>
            <Card>
              {recovering ? (
                <Text style={[s.body, { color: theme.text }]}>
                  Recover only if the older library on this device belongs to you. It will be assigned to this
                  account and will not be available to other accounts. Your current library stays intact, and
                  a backup of the older data is kept on this device.
                </Text>
              ) : signingOut ? (
                <Text style={[s.body, { color: theme.text }]}>
                  This ends your current session. Your Votic account remains active and you can sign back in
                  later. Your documents and notes stored on this device will not be deleted.
                </Text>
              ) : final ? (
                <Text style={[s.body, { color: theme.text }]}>
                  This permanently deletes your Votic account and sign-in. It cannot be undone. You will be
                  signed out when deletion completes. Your local documents, notes, activity and pronunciations
                  will be erased, along with your private backend reports and billing profile. Anonymous cost
                  totals are retained for spending controls. If interrupted, retry to finish; some data may
                  already be erased. App Store or Google Play subscriptions must be managed separately.
                </Text>
              ) : (
                <>
                  <Text style={[s.title, { color: theme.text }]}>A permanent decision</Text>
                  <Text style={[s.body, { color: theme.text }]}>
                    This permanently deletes your Votic account and sign-in. Unlike signing out, this cannot
                    be undone.
                  </Text>
                  <Text style={[s.title, { color: theme.text }]}>Documents and notes on this device</Text>
                  <Text style={[s.body, { color: theme.text }]}>
                    Confirming deletion erases your account&apos;s documents, notes and settings on this
                    device. Other devices clear their account data when they next connect and detect deletion.
                  </Text>
                  <Text style={[s.title, { color: theme.text }]}>Manage your subscription separately</Text>
                  <Text style={[s.body, { color: theme.text }]}>
                    Deleting your Votic account does not cancel an App Store or Google Play subscription. If
                    you subscribed through either store, manage or cancel your subscription in that store’s
                    subscription settings.
                  </Text>
                </>
              )}
            </Card>
            {error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                style={[s.body, { color: destructive }]}
              >
                {error}
              </Text>
            ) : null}
            {busy ? (
              <Text accessibilityLiveRegion="polite" style={[s.body, { color: theme.mutedText }]}>
                {recovering ? "Recovering library…" : signingOut ? "Signing out…" : "Deleting account…"}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={final ? "Keep account" : "Cancel"}
              accessibilityHint="Closes this request without changing your account"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={close}
              style={[s.button, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <Text style={[s.title, { color: theme.text }]}>{final ? "Keep account" : "Cancel"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                recovering
                  ? "Recover my library"
                  : signingOut
                    ? "Sign out"
                    : final
                      ? "Delete account"
                      : "Continue"
              }
              accessibilityHint={
                recovering
                  ? "Assigns the older device library to this account while keeping a backup"
                  : signingOut
                    ? "Ends this session and keeps your account and local library"
                    : final
                      ? "Destructive action. Permanently deletes your account and signs you out"
                      : "Opens the final confirmation. Your account will not be deleted yet"
              }
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={() => {
                if (step === "deletion-info") setStep("deletion-final");
                else void execute(recovering ? "recover" : signingOut ? "sign-out" : "delete");
              }}
              style={[
                s.button,
                {
                  borderColor: final ? destructive : theme.accent,
                  backgroundColor: final ? theme.surface : theme.accent,
                },
              ]}
            >
              <Text style={[s.title, { color: final ? destructive : theme.onAccent }]}>
                {recovering
                  ? "Recover my library"
                  : signingOut
                    ? "Sign out"
                    : final
                      ? "Delete account"
                      : "Continue"}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
/** Votic Premium as the store reports it: manage it in the store, or restore a purchase. */
function PremiumRows() {
  const subscription = useSubscription();
  const { theme } = useVoticTheme();
  const [restoreMessage, setRestoreMessage] = useState("");
  // Builds that can't reach the store (Expo Go, missing keys) have nothing to manage or restore.
  if (subscription.service.unavailableReason) return null;
  async function restore() {
    setRestoreMessage("");
    const restored = await subscription.service.restore();
    if (has_access(restored.status)) {
      subscription.setEntitlement(restored);
      setRestoreMessage("Your Votic Premium subscription is active.");
    } else if (restored.status === "unknown")
      setRestoreMessage("Votic couldn't reach the store. Check your connection and try again.");
    else setRestoreMessage("No active Votic Premium subscription was found for this store account.");
  }
  return (
    <>
      <AccountRow
        label="Votic Premium"
        detail={subscription_status(subscription.entitlement)}
        hint="Opens your store account to manage the subscription"
        icon="sparkles-outline"
        onPress={() =>
          void Linking.openURL(subscription.entitlement.managementUrl || STORE_SUBSCRIPTIONS_URL)
        }
      />
      <AccountRow
        label="Restore purchases"
        detail="Already subscribed with this store account? Restore it here."
        hint="Checks the store for an existing Votic Premium subscription"
        icon="refresh-outline"
        onPress={() => void restore()}
      />
      {restoreMessage ? (
        <Text accessibilityLiveRegion="polite" style={[s.detail, { color: theme.mutedText }]}>
          {restoreMessage}
        </Text>
      ) : null}
    </>
  );
}

function AccountRow({
  label,
  detail,
  hint,
  icon,
  onPress,
  danger = false,
  ref,
}: {
  label: string;
  detail: string;
  hint: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  danger?: boolean;
  ref?: Ref<View>;
}) {
  const { theme } = useVoticTheme();
  const destructive = theme.isDark ? "#FFB4B4" : "#B91C1C";
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        { backgroundColor: pressed ? theme.surfaceMuted : theme.surface, borderColor: theme.border },
      ]}
    >
      <Ionicons name={icon} size={24} color={danger ? destructive : theme.accentText} accessible={false} />
      <View style={s.copy}>
        <Text style={[s.title, { color: danger ? destructive : theme.text }]}>{label}</Text>
        <Text style={[s.detail, { color: theme.mutedText }]}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.mutedText} accessible={false} />
    </Pressable>
  );
}
const s = StyleSheet.create({
  section: { gap: spacing.md },
  heading: { ...typography.sectionTitle },
  label: { ...typography.eyebrow, marginTop: spacing.sm },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: controlSizes.icon,
    height: controlSizes.icon,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: spacing.xs },
  row: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  title: { ...typography.control },
  detail: { fontSize: 15, lineHeight: 22 },
  deletion: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, gap: spacing.md },
  safe: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  modalTitle: { ...typography.screenTitle },
  body: { ...typography.body },
  button: {
    minHeight: controlSizes.minimumTouch,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
