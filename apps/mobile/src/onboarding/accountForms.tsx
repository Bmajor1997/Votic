import { editorial } from "../design/editorial";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { ReactNode, forwardRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import { SignInCancelled, auth_error_message } from "../auth/authErrors";
import { controlSizes, radii, spacing } from "../design/tokens";
import { useSubscription } from "../subscription/SubscriptionProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { BrandMark } from "./WelcomeMotion";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** The frame of the account screens: a back button, a title, and a form that stays above the keyboard. */
export function AccountScaffold({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { theme } = useVoticTheme();
  return (
    <SafeAreaView style={[s.fill, { backgroundColor: theme.background }]}>
      <View style={s.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={({ pressed }) => [s.iconButton, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.mark}>
            <BrandMark size={64} />
          </View>
          <View style={s.heading}>
            <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
              {title}
            </Text>
            {subtitle ? <Text style={[s.subtitle, { color: theme.mutedText }]}>{subtitle}</Text> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Provider = "apple" | "google";

/**
 * Sign in with Apple and Google. Both create the account the first time and sign in after that, so the same
 * buttons appear on Create Account and Sign In. Each only shows where it actually works in this build.
 */
export function SocialSignIn({
  disabled,
  onBusyChange,
  onError,
}: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onError: (message: string) => void;
}) {
  const { theme } = useVoticTheme();
  const auth = useAuth();
  const [busy, setBusy] = useState<Provider | null>(null);
  if (!auth.appleAvailable && !auth.googleAvailable) return null;

  async function continue_with(provider: Provider) {
    if (busy || disabled) return;
    onError("");
    setBusy(provider);
    onBusyChange?.(true);
    try {
      if (provider === "apple") await auth.signInWithApple();
      else await auth.signInWithGoogle();
      // Signing in changes which screens exist, and the router moves on by itself.
    } catch (failure) {
      if (!(failure instanceof SignInCancelled)) onError(auth_error_message(failure));
    } finally {
      setBusy(null);
      onBusyChange?.(false);
    }
  }

  return (
    <View style={s.social}>
      {auth.appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            theme.isDark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radii.md}
          style={s.appleButton}
          onPress={() => void continue_with("apple")}
        />
      ) : null}
      {auth.googleAvailable ? (
        <GoogleButton
          busy={busy === "google"}
          disabled={busy !== null || Boolean(disabled)}
          onPress={() => void continue_with("google")}
        />
      ) : null}
    </View>
  );
}

/**
 * Google's own sign-in button style: a white pill with a thin gray border and bold dark label (dark theme: Google's
 * dark variant). Uses the one-color G glyph until Google's official multicolor "G" asset is added to the app.
 */
function GoogleButton({
  busy,
  disabled,
  onPress,
}: {
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  const colors = theme.isDark
    ? { fill: "#131314", pressed: "#2A2A2C", border: "#8E918F", text: "#E3E3E3" }
    : { fill: "#FFFFFF", pressed: "#F2F2F2", border: "#DADCE0", text: "#1F1F1F" };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      testID="google-sign-in"
      style={({ pressed }) => [
        s.googleButton,
        {
          backgroundColor: pressed ? colors.pressed : colors.fill,
          borderColor: colors.border,
          opacity: disabled && !busy ? 0.55 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Ionicons name="logo-google" size={22} color={colors.text} accessible={false} />
      )}
      <Text allowFontScaling style={[s.googleText, { color: colors.text }]}>
        Continue with Google
      </Text>
    </Pressable>
  );
}

/** "or continue with email", shown only when there are other ways to continue above it. */
export function EmailDivider({ label }: { label: string }) {
  const { theme } = useVoticTheme();
  const auth = useAuth();
  if (!auth.appleAvailable && !auth.googleAvailable) return null;
  return (
    <View style={s.divider} accessibilityRole="text">
      <View style={[s.rule, { backgroundColor: theme.border }]} />
      <Text style={[s.dividerText, { color: theme.mutedText }]}>{label}</Text>
      <View style={[s.rule, { backgroundColor: theme.border }]} />
    </View>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: theme.text }]}>{label}</Text>
      {children}
      {error ? (
        <View style={s.fieldNoteRow}>
          <Ionicons name="alert-circle" size={16} color={theme.accentText} />
          <Text accessibilityLiveRegion="polite" style={[s.fieldNote, { color: theme.text }]}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text style={[s.fieldNote, { color: theme.mutedText }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const EmailInput = forwardRef<TextInput, TextInputProps & { invalid?: boolean }>(function EmailInput(
  { invalid, style, ...props },
  ref,
) {
  const { theme } = useVoticTheme();
  return (
    <TextInput
      ref={ref}
      autoCapitalize="none"
      autoCorrect={false}
      // The email is the account name: these let Android's and iOS's password managers offer, fill and save
      // the email and password together.
      autoComplete="email"
      textContentType="username"
      importantForAutofill="yes"
      keyboardType="email-address"
      accessibilityLabel="Email"
      placeholder="you@example.com"
      placeholderTextColor={theme.mutedText}
      style={[
        s.input,
        {
          color: theme.text,
          borderColor: invalid ? theme.accentText : theme.border,
          backgroundColor: theme.surface,
        },
        style,
      ]}
      {...props}
    />
  );
});

/** A password field with a show/hide button. `kind` decides which password the system offers to fill or save. */
export const PasswordInput = forwardRef<
  TextInput,
  TextInputProps & { invalid?: boolean; kind: "new" | "current" }
>(function PasswordInput({ invalid, kind, ...props }, ref) {
  const { theme } = useVoticTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View
      style={[
        s.passwordRow,
        { borderColor: invalid ? theme.accentText : theme.border, backgroundColor: theme.surface },
      ]}
    >
      <TextInput
        ref={ref}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={kind === "new" ? "new-password" : "current-password"}
        textContentType={kind === "new" ? "newPassword" : "password"}
        importantForAutofill="yes"
        accessibilityLabel="Password"
        style={[s.passwordInput, { color: theme.text }]}
        {...props}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        onPress={() => setVisible((value) => !value)}
        style={s.reveal}
      >
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={theme.mutedText} />
      </Pressable>
    </View>
  );
});

/** A friendly message about the whole form. Actions (like "Sign in instead") can sit under it. */
export function FormMessage({
  icon = "alert-circle-outline",
  text,
  children,
}: {
  icon?: IconName;
  text: string;
  children?: ReactNode;
}) {
  const { theme } = useVoticTheme();
  return (
    <View accessibilityRole="alert" style={[s.message, { backgroundColor: theme.surfaceMuted }]}>
      <Ionicons name={icon} size={20} color={theme.accentText} />
      <View style={s.messageCopy}>
        <Text style={[s.messageText, { color: theme.text }]}>{text}</Text>
        {children}
      </View>
    </View>
  );
}

/** A plain-text prompt with an inline link, e.g. "Already have an account? Sign in". */
export function SwitchPrompt({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${prompt} ${action}`}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.switch, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[s.switchText, { color: theme.mutedText }]}>
        {prompt} <Text style={{ color: theme.accentText, fontWeight: "800" }}>{action}</Text>
      </Text>
    </Pressable>
  );
}

/** Shown when this build has no Firebase settings, so nobody is offered a sign-in that can't work. */
export function NotConfiguredNotice() {
  const { theme } = useVoticTheme();
  const auth = useAuth();
  if (auth.configured) return null;
  return (
    <View style={[s.notice, { backgroundColor: theme.surfaceMuted }]}>
      <Text style={[s.noticeText, { color: theme.text }]}>Account sign-in is unavailable in this build.</Text>
      {auth.canContinueWithoutAccount ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={auth.continueWithoutAccount}
            hitSlop={8}
            style={s.noticeAction}
          >
            <Text style={[s.noticeActionText, { color: theme.accentText }]}>
              Explore Votic without an account
            </Text>
          </Pressable>
          <Text style={[s.noticeText, { color: theme.mutedText }]}>
            Testing access only. Account actions require signing in.
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** Links to Terms and Privacy when this build has them; plain text otherwise, never a made-up address. */
export function LegalLine() {
  const { theme } = useVoticTheme();
  const { legal } = useSubscription();
  const link = (label: string, url: string | null) =>
    url ? (
      <Text
        accessibilityRole="link"
        onPress={() => void Linking.openURL(url)}
        style={{ color: theme.text, textDecorationLine: "underline" }}
      >
        {label}
      </Text>
    ) : (
      label
    );
  return (
    <Text style={[s.legal, { color: theme.mutedText }]}>
      By continuing, you agree to Votic&apos;s {link("Terms", legal.termsUrl)} and{" "}
      {link("Privacy Policy", legal.privacyUrl)}.
    </Text>
  );
}

export const accountStyles = StyleSheet.create({
  form: { gap: spacing.lg },
  actions: { gap: spacing.md },
});

const s = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { minHeight: 56, justifyContent: "center", paddingHorizontal: spacing.sm },
  iconButton: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  heading: { gap: spacing.sm, marginBottom: spacing.xs, alignItems: "center" },
  // The V's glow is wider than the tile, so it tucks into the space around the title.
  mark: { alignItems: "center", marginTop: -spacing.lg, marginBottom: -spacing.xl - 6 },
  title: { ...editorial, fontSize: 34, lineHeight: 42, textAlign: "center" },
  subtitle: { fontSize: 16, lineHeight: 23, textAlign: "center" },
  social: { gap: spacing.md },
  appleButton: { height: 54, width: "100%" },
  googleButton: {
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: spacing.lg,
  },
  googleText: { fontSize: 17, fontWeight: "700", letterSpacing: 0.1 },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 14, fontWeight: "600" },
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
  fieldNoteRow: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  fieldNote: { flexShrink: 1, fontSize: 14, lineHeight: 19 },
  message: {
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  messageCopy: { flex: 1, gap: spacing.xs, alignItems: "flex-start" },
  messageText: { fontSize: 15, lineHeight: 21 },
  switch: { minHeight: controlSizes.minimumTouch, justifyContent: "center", alignSelf: "center" },
  switchText: { fontSize: 15, textAlign: "center" },
  notice: { borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  noticeText: { fontSize: 14, lineHeight: 20 },
  noticeAction: { minHeight: controlSizes.minimumTouch, justifyContent: "center" },
  noticeActionText: { fontSize: 15, fontWeight: "800" },
  legal: { fontSize: 13, lineHeight: 18, textAlign: "center" },
});
