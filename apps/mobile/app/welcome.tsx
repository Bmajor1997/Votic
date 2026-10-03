import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../src/accessibility/AccessibilityProvider";
import { useAuth } from "../src/auth/AuthProvider";
import { SignInCancelled, authErrorMessage } from "../src/auth/authErrors";
import { VoticLogo } from "../src/components/VoticLogo";
import { radii, spacing, typography } from "../src/design/tokens";
import { SecondaryButton, TextButton } from "../src/onboarding/components";
import { HeroStage, ReaderHero } from "../src/onboarding/ReaderHero";
import { useVoticTheme } from "../src/theme/ThemeProvider";

type Provider = "apple" | "google";

const HERO_STAGES: { stage: HeroStage; phrase: string }[] = [
  { stage: "read", phrase: "read." },
  { stage: "listen", phrase: "listen to." },
  { stage: "understand", phrase: "understand." },
  { stage: "remember", phrase: "remember." },
];
const HERO_STAGE_MS = 2500;

export default function Welcome() {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const auth = useAuth();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(
      () => setHeroIndex((current) => (current + 1) % HERO_STAGES.length),
      HERO_STAGE_MS,
    );
    return () => clearInterval(timer);
  }, [reduceMotion]);

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

  const hero = HERO_STAGES[reduceMotion ? 0 : heroIndex];

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
              Your documents.
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={[s.dynamicTitle, { color: theme.text }]}
            >
              Easier to <Text style={{ color: theme.accent }}>{hero.phrase}</Text>
            </Text>
            <Text style={[s.subtitle, { color: theme.mutedText }]}>
              Read, listen, ask questions, and keep what matters.
            </Text>
          </View>

          <View style={s.hero}>
            <ReaderHero stage={hero.stage} />
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
  copy: { gap: spacing.xs, maxWidth: 350 },
  title: { ...typography.screenTitle, fontSize: 34, lineHeight: 39, letterSpacing: -0.8 },
  dynamicTitle: {
    ...typography.screenTitle,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.8,
    minHeight: 78,
  },
  subtitle: { fontSize: 16, lineHeight: 23, fontWeight: "600", marginTop: spacing.xs },
  hero: { marginTop: spacing.xs },
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
