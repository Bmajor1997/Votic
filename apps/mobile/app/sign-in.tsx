import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";
import { authErrorMessage, looksLikeEmail } from "../src/auth/authErrors";
import {
  AccountScaffold,
  EmailDivider,
  EmailInput,
  Field,
  FormMessage,
  NotConfiguredNotice,
  PasswordInput,
  SocialSignIn,
  SwitchPrompt,
  accountStyles,
} from "../src/onboarding/accountForms";
import { PrimaryButton, TextButton } from "../src/onboarding/components";

export default function SignIn() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [error, setError] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const emailError = triedSubmit && !looksLikeEmail(email) ? "Enter a valid email address." : "";
  const passwordError = triedSubmit && !password ? "Enter your password." : "";

  async function submit() {
    setTriedSubmit(true);
    setError("");
    if (!looksLikeEmail(email) || !password || busy || socialBusy) return;
    setBusy(true);
    try {
      await auth.signIn(email, password);
      // Signing in changes which screens exist, and the router moves on by itself.
    } catch (failure) {
      setError(authErrorMessage(failure));
      // Never keep a rejected password around.
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountScaffold title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <SocialSignIn disabled={busy} onBusyChange={setSocialBusy} onError={setError} />
      <EmailDivider label="or sign in with email" />
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
        <Field label="Password" error={passwordError}>
          <PasswordInput
            ref={passwordRef}
            kind="current"
            value={password}
            onChangeText={setPassword}
            invalid={Boolean(passwordError)}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            accessibilityHint={passwordError || undefined}
          />
        </Field>
        <View style={{ alignSelf: "flex-end" }}>
          <TextButton
            label="Forgot password?"
            onPress={() =>
              router.push({
                pathname: "/forgot-password",
                params: email.trim() ? { email: email.trim() } : {},
              })
            }
          />
        </View>
      </View>
      {error ? <FormMessage text={error} /> : null}
      <PrimaryButton label="Sign in" busy={busy} disabled={socialBusy} onPress={() => void submit()} />
      <NotConfiguredNotice />
      <SwitchPrompt
        prompt="New to Votic?"
        action="Create an account"
        onPress={() => router.replace("/create-account")}
      />
    </AccountScaffold>
  );
}
