import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";
import { auth_error_message, looks_like_email } from "../src/auth/authErrors";
import {
  AccountScaffold,
  EmailInput,
  Field,
  FormMessage,
  accountStyles,
} from "../src/onboarding/accountForms";
import { PrimaryButton, TextButton } from "../src/onboarding/components";

export default function ForgotPassword() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const emailError = triedSubmit && !looks_like_email(email) ? "Enter a valid email address." : "";

  async function send() {
    setTriedSubmit(true);
    setError("");
    if (!looks_like_email(email) || busy) return;
    setBusy(true);
    try {
      await auth.sendPasswordReset(email);
      setSentTo(email.trim());
    } catch (failure) {
      // An unknown email gets the same answer as a known one, so this screen never reveals who has an account.
      if ((failure as { code?: string })?.code === "auth/user-not-found") setSentTo(email.trim());
      else setError(auth_error_message(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountScaffold
      title="Reset your password"
      subtitle="Enter the email you use for Votic. We'll send a link to choose a new password."
    >
      <View style={accountStyles.form}>
        <Field label="Email" error={emailError}>
          <EmailInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setSentTo("");
            }}
            invalid={Boolean(emailError)}
            returnKeyType="send"
            onSubmitEditing={() => void send()}
            accessibilityHint={emailError || undefined}
          />
        </Field>
      </View>
      {sentTo ? (
        <FormMessage
          icon="mail-unread-outline"
          text={`If ${sentTo} has a Votic account, a reset link is on its way. Check your inbox and spam folder.`}
        />
      ) : null}
      {error ? <FormMessage text={error} /> : null}
      <PrimaryButton
        label={sentTo ? "Send again" : "Send reset link"}
        busy={busy}
        onPress={() => void send()}
      />
      <TextButton label="Back to sign in" onPress={() => router.back()} />
    </AccountScaffold>
  );
}
