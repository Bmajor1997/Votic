import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthProvider";
import { SignInCancelled, authErrorMessage } from "../src/auth/authErrors";
import { VoticLogo } from "../src/components/VoticLogo";
import { radii, spacing, typography } from "../src/design/tokens";
import { SecondaryButton, TextButton } from "../src/onboarding/components";
import { ReaderHero } from "../src/onboarding/ReaderHero";
import { useVoticTheme } from "../src/theme/ThemeProvider";

type Provider = "apple" | "google";

export default function Welcome() {
  const { theme } = useVoticTheme();
  const auth = useAuth();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState("");

  async function continueWith(provider: Provider) {
    if (busy) return;
    setError("");
    setBusy(provider);
    try {
      if (provider === "apple") await auth.signInWithApple();
      else await auth.signInWithGoogle();
    } catch (failure) {
      if (!(failure instanceof SignInCancelled)) setError(authErrorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.heroShell, { backgroundColor: theme.surfaceMuted }]}>
          <View pointerEvents="none" style={[s.glowLarge, { backgroundColor: theme.accent }]} />
          <View pointerEvents="none" style={[s.glowSmall, { backgroundColor: theme.wordHighlight }]} />
          <View style={s.brand}>
            <VoticLogo />
          </View>

          <View style={s.copy}>
            <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
              Understand anything you read.
            </Text>
            <Text style={[s.subtitle, { color: theme.mutedText }]}>
              Read it. Hear it. Ask about it.
            </Text>
          </View>

          <View style={s.hero}>
            <ReaderHero />
          </View>

          <View
            accessible
            accessibilityLabel="Votic helps you read, listen, and ask questions"
            style={s.benefits}
          >
            <Benefit icon="book-outline" label="Read" color={theme.accent} textColor={theme.text} />
            <Benefit icon="headset-outline" label="Listen" color={theme.accent} textColor={theme.text} />
            <Benefit icon="sparkles-outline" label="Ask Votic" color={theme.accent} textColor={theme.text} />
          </View>
        </View>

        <View
          style={[
            s.actionCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={s.actionHeading}>
            <Text style={[s.actionTitle, { color: theme.text }]}>Start with Votic</Text>
            <Text style={[s.actionSubtitle, { color: theme.mutedText }]}>
              Your documents, made easier to understand.
            </Text>
          </View>

          <View style={s.actions}>
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
                onPress={() => void continueWith("apple")}
              />
            ) : null}
            {auth.googleAvailable ? (
              <SecondaryButton
                label="Continue with Google"
                busy={busy === "google"}
                disabled={busy !== null}
                icon={<Ionicons name="logo-google" size={19} color={theme.text} />}
                onPress={() => void continueWith("google")}
              />
            ) : null}
            <SecondaryButton
              label="Continue with email"
              disabled={busy !== null}
              icon={<Ionicons name="mail-outline" size={20} color={theme.text} />}
              onPress={() => router.push("/sign-in")}
            />
            {error ? (
              <Text accessibilityRole="alert" style={[s.error, { color: theme.text }]}>
                {error}
              </Text>
            ) : null}
            {!auth.configured ? (
              <View style={[s.notice, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[s.noticeText, { color: theme.text }]}>
                  Sign-in isn&apos;t set up in this build yet. Add the Firebase settings described in the
                  README.
                </Text>
                {auth.canContinueWithoutAccount ? (
                  <TextButton
                    label="Continue without an account (development)"
                    onPress={auth.continueWithoutAccount}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <Text style={[s.legal, { color: theme.mutedText }]}>
          By continuing, you agree to Votic&apos;s Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({
  icon,
  label,
  color,
  textColor,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  color: string;
  textColor: string;
}) {
  return (
    <View style={s.benefit}>
      <View style={[s.benefitIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
      </View>
      <Text style={[s.benefitText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.lg, gap: spacing.lg },
  heroShell: {
    marginHorizontal: spacing.md,
    borderRadius: radii.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    overflow: "hidden",
  },
  glowLarge: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    opacity: 0.13,
    right: -72,
    top: -78,
  },
  glowSmall: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    left: -62,
    bottom: 40,
    opacity: 0.55,
  },
  brand: { minHeight: 48, justifyContent: "center" },
  copy: { gap: spacing.xs, maxWidth: 330 },
  title: { ...typography.screenTitle, fontSize: 34, lineHeight: 39, letterSpacing: -0.8 },
  subtitle: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
  hero: { marginTop: spacing.xs },
  benefits: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  benefit: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: { fontSize: 13, fontWeight: "800", flexShrink: 1 },
  actionCard: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  actionHeading: { gap: spacing.xs },
  actionTitle: { fontSize: 20, lineHeight: 25, fontWeight: "800" },
  actionSubtitle: { fontSize: 15, lineHeight: 21 },
  actions: { gap: spacing.md },
  appleButton: { height: 54, width: "100%" },
  error: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  notice: { borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  noticeText: { fontSize: 14, lineHeight: 20 },
  legal: { fontSize: 12, lineHeight: 17, textAlign: "center", paddingHorizontal: spacing.xl },
});
