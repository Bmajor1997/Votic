import { remember_feedback_form, take_feedback_draft } from "./feedbackNavigation";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { FeedbackSubmitError, submit_feedback } from "../api/voticApi";
import { radii, spacing, typography } from "../design/tokens";
import { PrimaryButton } from "../onboarding/components";
import { SettingsGroup, SettingsPage, SettingsRow } from "../settings/SettingsNavigation";
import { useVoticTheme } from "../theme/ThemeProvider";

export function FeedbackScreen() {
  return (
    <SettingsPage title="Feedback">
      <SettingsGroup>
        <SettingsRow
          label="Suggest a Feature"
          detail="Suggest improvements to make Votic work better for you."
          icon="bulb-outline"
          hint="Opens the feature suggestion form"
          onPress={() => router.push("/feedback/feature")}
        />
        <SettingsRow
          label="Report a Bug"
          detail="Tell us about a problem you experienced in Votic."
          icon="bug-outline"
          hint="Opens the bug report form"
          separated
          onPress={() => router.push("/feedback/bug")}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}
const definitions = [
  { key: "title", label: "Title (required)", max: 120 },
  { key: "description", label: "Description (required)", max: 5000 },
] as const;
const empty = { title: "", description: "" };
type Values = typeof empty;

/** The required-field message for what is still missing, or "" once both fields are filled. */
export function missing_fields_message({ title, description }: Values) {
  const needsTitle = !title.trim(),
    needsDescription = !description.trim();
  if (needsTitle && needsDescription) return "Enter a title and description before submitting.";
  if (needsTitle) return "Enter a title before submitting.";
  if (needsDescription) return "Enter a description before submitting.";
  return "";
}

export function FeedbackForm({ category }: { category: "feature" | "bug" }) {
  const auth = useAuth();
  // Key the form by verified account so drafts and in-flight results cannot cross account boundaries.
  return <OwnedFeedbackForm key={`${auth.user?.uid ?? "signed-out"}:${category}`} category={category} />;
}
function OwnedFeedbackForm({ category }: { category: "feature" | "bug" }) {
  const { theme } = useVoticTheme();
  const auth = useAuth();
  // A draft held while this account signed in again comes back; any other account starts empty.
  const [values, setValues] = useState<Values>(() => take_feedback_draft(category, auth.user?.uid) ?? empty);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  // Required-field checking starts at the first submit and then follows the fields as they are corrected.
  const [validating, setValidating] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const requestId = useRef(randomUUID());
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const feature = category === "feature";
  const title = feature ? "Suggest a Feature" : "Report a Bug";
  const signedIn = Boolean(auth.user && auth.configured && auth.user.uid !== "development");
  const validation = validating ? missing_fields_message(values) : "";
  function sign_in_again() {
    remember_feedback_form(category, auth.user ? { uid: auth.user.uid, draft: values } : undefined);
    router.push("/sign-in");
  }
  async function submit() {
    if (pending.current) return;
    if (!signedIn) {
      remember_feedback_form(category);
      router.push("/sign-in");
      return;
    }
    setValidating(true);
    if (missing_fields_message(values)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setSessionExpired(false);
    try {
      await submit_feedback({ ...values, category, requestId: requestId.current });
      if (mounted.current) setSent(true);
    } catch (failure) {
      if (!mounted.current) return;
      // The draft stays in the form for every failure, so the person can retry without retyping.
      setSessionExpired(
        failure instanceof FeedbackSubmitError &&
          (failure.code === "AUTH_EXPIRED" || failure.code === "AUTH_REQUIRED"),
      );
      setError(failure instanceof Error ? failure.message : "Feedback could not be sent. Please try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <SettingsPage
        title={title}
        backLabel="Back to Feedback"
        backHint="Returns to the two feedback options"
        onBack={() => router.replace("/feedback")}
      >
        {sent ? (
          <View style={s.fields}>
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[s.text, { color: theme.text }]}
            >
              {feature
                ? "Thanks for your suggestion! Your feedback helps make Votic better."
                : "Thanks for reporting this issue! Your feedback helps us improve Votic."}
            </Text>
            <PrimaryButton label="Back to Feedback" onPress={() => router.replace("/feedback")} />
          </View>
        ) : (
          <View style={s.fields}>
            <Text style={[s.text, { color: theme.mutedText }]}>
              Your feedback is private and shared with the Votic team. Please avoid passwords, payment
              details, and private document content.
            </Text>
            {definitions.map((field) => (
              <View key={field.key} style={s.field}>
                <Text style={[s.label, { color: theme.text }]}>{field.label}</Text>
                <TextInput
                  accessibilityLabel={field.label}
                  accessibilityHint={`Maximum ${field.max} characters`}
                  value={values[field.key]}
                  maxLength={field.max}
                  editable={!busy}
                  multiline={field.key !== "title"}
                  textAlignVertical="top"
                  onChangeText={(value) => {
                    requestId.current = randomUUID();
                    setValues((current) => ({ ...current, [field.key]: value }));
                  }}
                  placeholderTextColor={theme.mutedText}
                  style={[
                    s.input,
                    field.key !== "title" && s.multiline,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                />
              </View>
            ))}
            {validation ? (
              <Text
                testID="feedback-validation"
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[s.text, { color: theme.text }]}
              >
                {validation}
              </Text>
            ) : null}
            {error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[s.text, { color: theme.text }]}
              >
                {error}
              </Text>
            ) : null}
            {sessionExpired ? <PrimaryButton label="Sign in again" onPress={sign_in_again} /> : null}
            {!signedIn ? (
              <Text style={[s.text, { color: theme.text }]}>
                Sign in with your Votic account to submit feedback.
              </Text>
            ) : null}
            <PrimaryButton
              label={signedIn ? "Submit" : "Sign in to submit feedback"}
              busy={busy}
              onPress={() => void submit()}
            />
          </View>
        )}
      </SettingsPage>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  fields: { gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { ...typography.control },
  text: { fontSize: 16, lineHeight: 24 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, fontSize: 16 },
  multiline: { minHeight: 130 },
});
