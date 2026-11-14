import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";
import {
  auth_error_message,
  looks_like_email,
  password_problem,
  PASSWORD_REQUIREMENTS,
} from "../src/auth/authErrors";
import {
  AccountScaffold,
  EmailInput,
  Field,
  FormMessage,
  NotConfiguredNotice,
  PasswordInput,
  LegalLine,
  SwitchPrompt,
  accountStyles,
} from "../src/onboarding/accountForms";
import { PrimaryButton, TextButton } from "../src/onboarding/components";

export default function CreateAccount() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountExists, setAccountExists] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const emailError = triedSubmit && !looks_like_email(email) ? "Enter a valid email address." : "";
  const problem = password_problem(password);
  const passwordError = triedSubmit && problem ? problem : "";

  async function submit() {
    setTriedSubmit(true);
    setError("");
    setAccountExists(false);
    if (!looks_like_email(email) || problem || busy) return;
    setBusy(true);
    try {
      await auth.create_account(email, password);
      // Signing in changes which screens exist, and the router moves on by itself.
    } catch (failure) {
      setAccountExists((failure as { code?: string })?.code === "auth/email-already-in-use");
      setError(auth_error_message(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountScaffold
      title="Create your account"
      subtitle="Your account keeps your setup and subscription with you."
    >
      <View style={accountStyles.form}>
        <Field label="Email" error={emailError}>
          <EmailInput
            value={email}
            onChangeText={setEmail}
            invalid={Boolean(emailError)}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityHint={emailError || undefined}
          />
        </Field>
        <Field label="Password" error={passwordError} hint={PASSWORD_REQUIREMENTS}>
          <PasswordInput
            ref={passwordRef}
            kind="new"
            value={password}
            onChangeText={setPassword}
            invalid={Boolean(passwordError)}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            accessibilityHint={passwordError || undefined}
          />
        </Field>
      </View>
      {error ? (
        <FormMessage text={error}>
          {accountExists ? (
            <TextButton
              label="Sign in instead"
              on_press={() => router.replace({ pathname: "/sign-in", params: { email: email.trim() } })}
            />
          ) : null}
        </FormMessage>
      ) : null}
      <PrimaryButton label="Create account" busy={busy} on_press={() => void submit()} />
      <NotConfiguredNotice />
      <SwitchPrompt
        prompt="Already have an account?"
        action="Sign in"
        on_press={() => router.replace("/sign-in")}
      />
      <LegalLine />
    </AccountScaffold>
  );
}
