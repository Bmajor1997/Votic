import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import { useSubscription } from "./SubscriptionProvider";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { SecondaryButton } from "../onboarding/components";
import { useVoticTheme } from "../theme/ThemeProvider";
import { AllowanceNotice, subscribe_allowance_notice } from "./allowanceNotice";
import { UpgradeOptions } from "./UpgradeOptions";

export function UpgradeNoticeHost() {
  const { user, homeEntrance } = useAuth();
  const { access, checking } = useSubscription();
  if (!user || !access || checking) return null;
  return <SessionNotice key={`${user.uid}:${homeEntrance.key()}`} />;
}
function SessionNotice() {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [notice, setNotice] = useState<AllowanceNotice | null>(null);
  useEffect(() => {
    const shown = new Set<string>();
    return subscribe_allowance_notice((next) => {
      if (shown.has(next.resetsAt)) return;
      shown.add(next.resetsAt);
      setNotice(next);
    });
  }, []);
  const dismiss = () => setNotice(null);
  if (!notice) return null;
  return (
    <Modal visible animationType={reduceMotion ? "none" : "slide"} onRequestClose={dismiss}>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={s.content}>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            Monthly AI allowance reached
          </Text>
          <Text style={[s.detail, { color: theme.mutedText }]}>
            Your allowance resets{" "}
            {new Date(notice.resetsAt).toLocaleString(undefined, {
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short",
            })}
            . You can keep reading, listening to saved text, and using your notes.
          </Text>
          <SecondaryButton label="Not now" onPress={dismiss} />
          <UpgradeOptions />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 24, gap: 20 },
  title: { fontSize: 26, fontWeight: "800" },
  detail: { fontSize: 16, lineHeight: 24 },
});
