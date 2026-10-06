import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthProvider";
import { SocialAuthButtons, useSocialAuth } from "../src/auth/SocialAuthButtons";
import { VoticLogo } from "../src/components/VoticLogo";
import { authErrorMessage, looksLikeEmail, passwordProblem } from "../src/auth/authErrors";
import { controlSizes, radii, spacing, typography } from "../src/design/tokens";
import { PrimaryButton, TextButton } from "../src/onboarding/components";
import { useVoticTheme } from "../src/theme/ThemeProvider";

type Mode = "create" | "sign-in";

export default function EmailSignIn() {
  const { theme } = useVoticTheme();
  const auth = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === "sign-in" ? "sign-in" : "create");
  const social = useSocialAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const creating = mode === "create";
  const blocked = busy || social.busy !== null;

  const emailError = triedSubmit && !looksLikeEmail(email) ? "Enter a valid email address." : "";
  const newPasswordProblem = creating ? passwordProblem(password) : password ? null : "Enter your password.";
  const passwordError = triedSubmit ? newPasswordProblem || "" : "";

  function switchMode() {
    if (blocked) return;
    social.setError("");
    setMode(creating ? "sign-in" : "create");
    setError("");
    setNotice("");
    setTriedSubmit(false);
  }

  async function submit() {
    setTriedSubmit(true);
    social.setError("");
    setError("");
    setNotice("");
    if (!looksLikeEmail(email) || newPasswordProblem || blocked) return;
    setBusy(true);
    try {
      if (creating) await auth.createAccount(email, password);
      else await auth.signIn(email, password);
      // Signing in changes which screens exist, and the router moves on by itself.
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (blocked) return;
    setError("");
    setNotice("");
    if (!looksLikeEmail(email)) {
      setTriedSubmit(true);
      setError("Enter your email above, then choose Forgot password again.");
      return;
    }
    try {
      await auth.sendPasswordReset(email);
      // The same message either way, so this screen never reveals which emails have accounts.
      setNotice(`If ${email.trim()} has a Votic account, a reset link is on its way.`);
    } catch (failure) {
      setError(authErrorMessage(failure));
    }
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={s.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={blocked}
          accessibilityState={{ disabled: blocked }}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
          style={({ pressed }) => [s.iconButton, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <VoticLogo compact />
      </View>
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.heading}>
            <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
              {creating ? "Create your account" : "Welcome back"}
            </Text>
            <Text style={[s.subtitle, { color: theme.mutedText }]}>
              {creating ? "Your ideas have a home here." : "Pick up where you left off."}
            </Text>
          </View>
          <SocialAuthButtons
            busy={social.busy}
            disabled={busy}
            onContinue={(provider) => {
              setError("");
              setNotice("");
              void social.continueWith(provider);
            }}
          />
          <View style={s.divider}>
            <View style={[s.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[s.dividerLabel, { color: theme.mutedText }]}>or use email</Text>
            <View style={[s.dividerLine, { backgroundColor: theme.border }]} />
          </View>
          <View style={s.formCard}>
            <View style={s.fields}>
              <Field label="Email" error={emailError}>
                <TextInput
                  editable={!blocked}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabel="Email"
                  accessibilityHint={emailError || undefined}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    s.input,
                    {
                      color: theme.text,
                      borderColor: emailError ? theme.accent : theme.border,
                      backgroundColor: theme.surfaceMuted,
                    },
                  ]}
                />
              </Field>
              <Field
                label="Password"
                error={passwordError}
                hint={
                  creating && !passwordError
                    ? "At least 8 characters, with a letter and a number."
                    : undefined
                }
              >
                <View
                  style={[
                    s.passwordRow,
                    {
                      borderColor: passwordError ? theme.accent : theme.border,
                      backgroundColor: theme.surfaceMuted,
                    },
                  ]}
                >
                  <TextInput
                    ref={passwordRef}
                    editable={!blocked}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={creating ? "new-password" : "current-password"}
                    textContentType={creating ? "newPassword" : "password"}
                    returnKeyType="go"
                    onSubmitEditing={() => void submit()}
                    accessibilityLabel="Password"
                    accessibilityHint={passwordError || undefined}
                    style={[s.passwordInput, { color: theme.text }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    onPress={() => setShowPassword((value) => !value)}
                    style={s.reveal}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color={theme.mutedText}
                    />
                  </Pressable>
                </View>
              </Field>
            </View>
            {error || social.error ? (
              <Message icon="alert-circle-outline" text={error || social.error} />
            ) : null}
            {notice ? <Message icon="mail-unread-outline" text={notice} /> : null}
            <PrimaryButton
              label={creating ? "Create account" : "Sign in"}
              busy={busy}
              disabled={social.busy !== null}
              onPress={() => void submit()}
            />
            {!creating ? (
              <TextButton disabled={blocked} label="Forgot password?" onPress={() => void resetPassword()} />
            ) : null}
            <TextButton
              disabled={blocked}
              label={creating ? "I already have an account" : "Create a new account"}
              onPress={switchMode}
            />
          </View>
          <Text style={[s.reassuranceText, { color: theme.mutedText }]}>
            By continuing, you agree to Votic&apos;s Terms and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: theme.text }]}>{label}</Text>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[s.fieldNote, { color: theme.text }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[s.fieldNote, { color: theme.mutedText }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

function Message({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  const { theme } = useVoticTheme();
  return (
    <View accessibilityRole="alert" style={[s.message, { backgroundColor: theme.surfaceMuted }]}>
      <Ionicons name={icon} size={20} color={theme.accentText} />
      <Text style={[s.messageText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.sm,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  iconButton: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  heading: { gap: spacing.sm, maxWidth: 350 },
  title: { ...typography.screenTitle, fontSize: 32, lineHeight: 38, letterSpacing: -0.7 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerLabel: { fontSize: 13 },
  formCard: { gap: spacing.lg },
  fields: { gap: spacing.lg },
  field: { gap: spacing.xs },
  label: { fontSize: 15, fontWeight: "700" },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 17,
  },
  passwordRow: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: { flex: 1, minHeight: 52, paddingHorizontal: spacing.md, fontSize: 17 },
  reveal: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldNote: { fontSize: 14, lineHeight: 19 },
  message: {
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  messageText: { flex: 1, fontSize: 15, lineHeight: 21 },
  reassuranceText: { fontSize: 12, lineHeight: 18, textAlign: "center" },
});
