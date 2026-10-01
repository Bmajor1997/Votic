import { useRef, useState } from "react";
import { TextInput } from "react-native";
import { AuthError } from "../../auth/authTypes";
import {
  CreateAccountFields,
  hasErrors,
  MIN_PASSWORD_LENGTH,
  validateCreateAccount,
} from "../../auth/authValidation";
import { useAccount } from "../AccountProvider";
import {
  Notice,
  OnboardingScreen,
  PrimaryButton,
  TextField,
  TextLink,
  Title,
} from "../components/OnboardingUI";

export function CreateAccountScreen({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
  const { createAccount } = useAccount();
  const [fields, setFields] = useState<CreateAccountFields>({
    firstName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<CreateAccountFields>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // A ref, not state, so a fast double tap can't start two sign-ups before React re-renders.
  const inFlight = useRef(false);
  const email = useRef<TextInput>(null);
  const password = useRef<TextInput>(null);
  const confirm = useRef<TextInput>(null);

  function change(key: keyof CreateAccountFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }
  async function submit() {
    if (inFlight.current) return;
    const found = validateCreateAccount(fields);
    setErrors(found);
    setFormError("");
    if (hasErrors(found)) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await createAccount({ firstName: fields.firstName, email: fields.email, password: fields.password });
      // The entry gate moves on to email verification once the account exists.
    } catch (error) {
      setFormError(error instanceof AuthError ? error.message : "Something went wrong. Please try again.");
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <OnboardingScreen
      onBack={onBack}
      footer={
        <>
          <PrimaryButton label="Create Account" onPress={() => void submit()} loading={submitting} />
          <TextLink
            prefix="Already have an account?"
            label="Sign In"
            onPress={onSignIn}
            disabled={submitting}
          />
        </>
      }
    >
      <Title subtitle="It only takes a moment.">Create your Votic account</Title>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <TextField
        label="First name"
        value={fields.firstName}
        onChangeText={(value) => change("firstName", value)}
        error={errors.firstName}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={() => email.current?.focus()}
        submitBehavior="submit"
        editable={!submitting}
      />
      <TextField
        ref={email}
        label="Email address"
        value={fields.email}
        onChangeText={(value) => change("email", value)}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => password.current?.focus()}
        submitBehavior="submit"
        editable={!submitting}
      />
      <TextField
        ref={password}
        label="Password"
        secure
        value={fields.password}
        onChangeText={(value) => change("password", value)}
        error={errors.password}
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters, with a letter and a number`}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirm.current?.focus()}
        submitBehavior="submit"
        editable={!submitting}
      />
      <TextField
        ref={confirm}
        label="Confirm password"
        secure
        value={fields.confirmPassword}
        onChangeText={(value) => change("confirmPassword", value)}
        error={errors.confirmPassword}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        editable={!submitting}
      />
    </OnboardingScreen>
  );
}
