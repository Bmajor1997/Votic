import { useRef, useState } from "react";
import { Linking, Text } from "react-native";
import { SettingsGroup, SettingsRow } from "./SettingsNavigation";
import { useVoticTheme } from "../theme/ThemeProvider";

export const SUPPORT_EMAIL = "votic.support@gmail.com";

export function SupportSettings() {
  const { theme } = useVoticTheme();
  const [error, setError] = useState(false);
  const pending = useRef(false);
  async function compose() {
    if (pending.current) return;
    pending.current = true;
    setError(false);
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Votic support")}`);
    } catch {
      setError(true);
    } finally {
      pending.current = false;
    }
  }
  return (
    <>
      <Text style={{ color: theme.text, fontSize: 17, lineHeight: 27 }}>
        Get help with your account, membership, or using Votic.
      </Text>
      <SettingsGroup>
        <SettingsRow
          label="Email support"
          detail={SUPPORT_EMAIL}
          hint="Opens your email app with a new message to Votic support"
          icon="mail-outline"
          onPress={() => void compose()}
        />
      </SettingsGroup>
      <Text selectable style={{ color: theme.mutedText, fontSize: 15, lineHeight: 23 }}>
        You can also write to {SUPPORT_EMAIL}. Describe what happened and what you expected. Only share
        documents or screenshots if you are comfortable sending them.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.text }}>
          Could not open your email app. Copy the email address above and send a message from your usual email
          service.
        </Text>
      ) : null}
    </>
  );
}
