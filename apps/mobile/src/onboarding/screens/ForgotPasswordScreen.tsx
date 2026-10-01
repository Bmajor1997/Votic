import { useRef, useState } from "react";
import { AuthError } from "../../auth/authTypes";
import { emailError } from "../../auth/authValidation";
import { useAccount } from "../AccountProvider";
import {
  Notice,
  OnboardingScreen,
  PrimaryButton,
  TextField,
  TextLink,
  Title,
} from "../components/OnboardingUI";

/** Sends Firebase's password-reset email. The result reads the same whether or not the email has an account. */
export function ForgotPasswordScreen({
  onBack,
  initialEmail = "",
}: {
  onBack: (email: string) => void;
  initialEmail?: string;
}) {
  const { services } = useAccount();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    const found = emailError(email);
    setError(found);
    setFormError("");
    if (found) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await services.auth.sendPasswordReset(email);
      setSent(true);
    } catch (caught) {
      setFormError(caught instanceof AuthError ? caught.message : "Something went wrong. Please try again.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <OnboardingScreen
      onBack={() => onBack(email)}
      footer={
        sent ? (
          <PrimaryButton label="Back to Sign In" onPress={() => onBack(email)} />
        ) : (
          <PrimaryButton label="Send Reset Link" onPress={() => void submit()} loading={submitting} />
        )
      }
    >
      <Title subtitle="Enter the email you use for Votic and we'll send a link to choose a new password.">
        Reset your password
      </Title>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {sent ? (
        <>
          <Notice tone="success">
            {`If there's a Votic account for ${email.trim()}, a reset link is on its way. Check your inbox and spam folder.`}
          </Notice>
          <TextLink label="Send again" onPress={() => void submit()} disabled={submitting} />
        </>
      ) : (
        <TextField
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(undefined);
          }}
          error={error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
          editable={!submitting}
        />
      )}
    </OnboardingScreen>
  );
}
