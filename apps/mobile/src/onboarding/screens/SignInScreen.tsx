import { useRef, useState } from "react";
import { TextInput } from "react-native";
import { AuthError } from "../../auth/authTypes";
import { hasErrors, validateSignIn } from "../../auth/authValidation";
import { useAccount } from "../AccountProvider";
import {
  Notice,
  OnboardingScreen,
  PrimaryButton,
  TextField,
  TextLink,
  Title,
} from "../components/OnboardingUI";

export function SignInScreen({
  onBack,
  onCreateAccount,
  onForgotPassword,
  initialEmail = "",
}: {
  onBack: () => void;
  onCreateAccount: () => void;
  onForgotPassword: (email: string) => void;
  initialEmail?: string;
}) {
  const { signIn } = useAccount();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (inFlight.current) return;
    const found = validateSignIn({ email, password });
    setErrors(found);
    setFormError("");
    if (hasErrors(found)) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await signIn({ email, password });
    } catch (error) {
      setFormError(error instanceof AuthError ? error.message : "Something went wrong. Please try again.");
      setPassword("");
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <OnboardingScreen
      onBack={onBack}
      footer={
        <>
          <PrimaryButton label="Sign In" onPress={() => void submit()} loading={submitting} />
          <TextLink
            prefix="Don't have an account?"
            label="Create Account"
            onPress={onCreateAccount}
            disabled={submitting}
          />
        </>
      }
    >
      <Title subtitle="Sign in to pick up where you left off.">Welcome back</Title>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
        }}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        editable={!submitting}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        secure
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
        }}
        error={errors.password}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        editable={!submitting}
      />
      <TextLink label="Forgot Password?" onPress={() => onForgotPassword(email)} disabled={submitting} />
    </OnboardingScreen>
  );
}
