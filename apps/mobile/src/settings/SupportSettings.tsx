import { useRef, useState } from "react";
import { Linking, Text } from "react-native";
import { SettingsGroup, SettingsRow } from "./SettingsNavigation";
import { useVoticTheme } from "../theme/ThemeProvider";

export const SUPPORT_EMAIL = "votic.support@gmail.com";
export const ACCESSIBILITY_DISCOUNT_SUBJECT = "Accessibility discount request";

export function SupportSettings() {
  const { theme } = useVoticTheme();
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function compose(subject = "Votic support") {
    if (pending.current) return;
    pending.current = true;
    setError(null);
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
    } catch {
      setError(subject);
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
      <SettingsGroup title="Accessibility discount">
        <SettingsRow
          label="Accessibility discount request"
          detail="Email a request for personal review and approval"
          hint="Opens your email app with the subject Accessibility discount request"
          icon="accessibility-outline"
          onPress={() => void compose(ACCESSIBILITY_DISCOUNT_SUBJECT)}
        />
      </SettingsGroup>
      <Text selectable style={{ color: theme.mutedText, fontSize: 15, lineHeight: 23 }}>
        This discount is intended for people with disabilities who need accessibility support for reading
        or using documents. Email {SUPPORT_EMAIL} with the subject {ACCESSIBILITY_DISCOUNT_SUBJECT}.
        Include your Votic account email, explain the accessibility barriers you face, the support you
        need, and why you are requesting the discount. No medical information is required at this stage.
        Each request is personally reviewed by Votic&apos;s owner. Approval is not guaranteed, and sending
        a request does not apply a discount. Please submit only one request per Votic account and wait for
        a reply before following up.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.text }}>
          Could not open your email app. Copy the email address above and send a message from your usual email
          service. Use the subject: {error}.
        </Text>
      ) : null}
    </>
  );
}
