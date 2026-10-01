import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";
import { authErrorMessage, looksLikeEmail, passwordProblem } from "../src/auth/authErrors";
import {
  AccountScaffold,
  EmailDivider,
  EmailInput,
  Field,
  FormMessage,
  NotConfiguredNotice,
  PasswordInput,
  SocialSignIn,
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
  const [socialBusy, setSocialBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountExists, setAccountExists] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const emailError = triedSubmit && !looksLikeEmail(email) ? "Enter a valid email address." : "";
  const problem = passwordProblem(password);
  const passwordError = triedSubmit && problem ? problem : "";

  async function submit() {
    setTriedSubmit(true);
    setError("");
    setAccountExists(false);
    if (!looksLikeEmail(email) || problem || busy || socialBusy) return;
    setBusy(true);
    try {
      await auth.createAccount(email, password);
      // Signing in changes which screens exist, and the router moves on by itself.
    } catch (failure) {
      setAccountExists((failure as { code?: string })?.code === "auth/email-already-in-use");
      setError(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountScaffold
      title="Create your account"
      subtitle="Your account keeps your setup and subscription with you."
    >
      <SocialSignIn disabled={busy} onBusyChange={setSocialBusy} onError={setError} />
      <EmailDivider label="or continue with email" />
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
        <Field
          label="Password"
          error={passwordError}
          hint={passwordError ? undefined : "At least 8 characters, with a letter and a number."}
        >
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
              onPress={() => router.replace({ pathname: "/sign-in", params: { email: email.trim() } })}
            />
          ) : null}
        </FormMessage>
      ) : null}
      <PrimaryButton label="Create account" busy={busy} disabled={socialBusy} onPress={() => void submit()} />
      <NotConfiguredNotice />
      <SwitchPrompt
        prompt="Already have an account?"
        action="Sign in"
        onPress={() => router.replace("/sign-in")}
      />
      <LegalLine />
    </AccountScaffold>
  );
}
