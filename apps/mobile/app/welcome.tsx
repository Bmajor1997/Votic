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
      // Signing in changes which screens exist, and the router moves on by itself.
    } catch (failure) {
      if (!(failure instanceof SignInCancelled)) setError(authErrorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.brand}>
          <VoticLogo />
        </View>
        <View style={s.hero}>
          <ReaderHero />
        </View>
        <View style={s.copy}>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            Make any document easier to read
          </Text>
          <Text style={[s.subtitle, { color: theme.mutedText }]}>
            Listen along, ask questions, and save what matters.
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
        <Text style={[s.legal, { color: theme.mutedText }]}>
          By continuing, you agree to Votic&apos;s Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.xl },
  brand: { minHeight: 58, justifyContent: "center" },
  hero: { flexGrow: 1, justifyContent: "center" },
  copy: { gap: spacing.sm },
  title: { ...typography.screenTitle, lineHeight: 36 },
  subtitle: { fontSize: 17, lineHeight: 25 },
  actions: { gap: spacing.md },
  appleButton: { height: 54, width: "100%" },
  error: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  notice: { borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  noticeText: { fontSize: 14, lineHeight: 20 },
  legal: { fontSize: 13, lineHeight: 18, textAlign: "center" },
});
