import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { account_storage_key } from "../storage/accountStorage";
import { write_account_data } from "../storage/accountDeletion";
import { AI_CONSENT_VERSION } from "../api/aiConsent";
import { DiagnosticsSettings } from "./DiagnosticsSettings";
import { PolicyLinks } from "./PolicyLinks";
import { useVoticTheme } from "../theme/ThemeProvider";

export function PrivacySettings() {
  const { user } = useAuth();
  const [notice, setNotice] = useState("");
  async function withdraw() {
    if (!user) return;
    try {
      await write_account_data(user.uid, () =>
        AsyncStorage.removeItem(
          account_storage_key(`votic.mobile.ai-consent.${AI_CONSENT_VERSION}`, user.uid),
        ),
      );
      setNotice(
        "AI sharing withdrawn for future requests on this device. Requests already sent cannot be recalled.",
      );
    } catch {
      setNotice("Your choice could not be saved. Please retry.");
    }
  }
  const { theme } = useVoticTheme();
  return (
    <>
      <Text style={{ color: theme.mutedText, fontSize: 15, lineHeight: 23 }}>
        Read Votic&apos;s policies and choose whether to share optional failure counts. Account deletion is
        available in Account &amp; Membership.
      </Text>
      <PolicyLinks />
      <Pressable
        accessibilityRole="button"
        onPress={() => void withdraw()}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={{ color: theme.accentText }}>Withdraw AI sharing consent</Text>
      </Pressable>
      {notice ? <Text style={{ color: theme.text }}>{notice}</Text> : null}
      <DiagnosticsSettings />
    </>
  );
}
