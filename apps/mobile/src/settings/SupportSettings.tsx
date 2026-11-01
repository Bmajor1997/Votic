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
        To request a disability discount, email {SUPPORT_EMAIL} with the subject{" "}
        {ACCESSIBILITY_DISCOUNT_SUBJECT}. Include your Votic account email. In your request, you must briefly
        explain how a disability affects reading or using documents, what accessibility support you need,
        and why you need the accessibility discount. You do not need to name your condition or share a
        diagnosis, medical details, or medical paperwork.
        Votic&apos;s owner personally reviews and approves each request. Sending a request does not
        automatically apply a discount. You will receive a reply with the decision and any next steps.
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
