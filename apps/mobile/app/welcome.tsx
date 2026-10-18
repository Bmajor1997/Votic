import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../src/components/VoticLogo";
import { spacing } from "../src/design/tokens";
import { LegalLine, NotConfiguredNotice, SocialSignIn } from "../src/onboarding/accountForms";
import { DriftingShelf, GlowMark, RiseIn, SpokenHeadline } from "../src/onboarding/WelcomeMotion";
import { useVoticTheme } from "../src/theme/ThemeProvider";

/**
 * The first screen. Apple and Google create the account or sign in; "Continue with email" creates a new
 * account; "Sign in" (top right) is for existing email accounts. Documents drift past at the top, the
 * Votic mark arrives from a glow, and the headline lights up word by word as if read aloud.
 */
export default function Welcome() {
  const { theme } = useVoticTheme();
  const [socialBusy, setSocialBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Documents, listening cards, and notes drift past behind the top of the screen. */}
        <View style={s.stage}>
          <DriftingShelf height={STAGE_HEIGHT} />
          <View style={s.topBar}>
            <View style={[s.logo, theme.elevation, { backgroundColor: theme.surface }]}>
              <VoticLogo />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              disabled={socialBusy}
              accessibilityState={{ disabled: socialBusy }}
              onPress={() => router.push("/sign-in")}
              style={({ pressed }) => [
                s.login,
                theme.elevation,
                { backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
              ]}
            >
              <Text style={[s.loginText, { color: theme.accentText }]}>Sign in</Text>
            </Pressable>
          </View>
        </View>
        <View style={[s.sheet, { backgroundColor: theme.surface, shadowColor: "#071A38" }]}>
          <View style={s.mark}>
            <GlowMark size={68} delay={120} />
          </View>
          <View style={s.copy}>
            <SpokenHeadline
              lines={["Make room for", "what matters."]}
              delay={700}
              style={[s.title, { color: theme.text }]}
            />
            <RiseIn delay={520}>
              <Text style={[s.subtitle, { color: theme.mutedText }]}>
                A place to read, listen, and keep your ideas.
              </Text>
            </RiseIn>
          </View>
          <RiseIn delay={700}>
            <View style={s.actions}>
              <SocialSignIn onBusyChange={setSocialBusy} onError={setError} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue with email"
                disabled={socialBusy}
                accessibilityState={{ disabled: socialBusy }}
                onPress={() => router.push("/create-account")}
                style={({ pressed }) => [
                  s.email,
                  { backgroundColor: theme.accent, opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <Ionicons name="mail-outline" size={20} color={theme.onAccent} />
                <Text style={[s.emailText, { color: theme.onAccent }]}>Continue with email</Text>
              </Pressable>
              {error ? (
                <Text accessibilityRole="alert" style={[s.message, { color: theme.text }]}>
                  {error}
                </Text>
              ) : null}
              <NotConfiguredNotice />
            </View>
          </RiseIn>
          <RiseIn delay={860}>
            <LegalLine />
          </RiseIn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const STAGE_HEIGHT = 330;

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1 },
  stage: { height: STAGE_HEIGHT },
  topBar: {
    position: "absolute",
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { minHeight: 48, borderRadius: 24, paddingHorizontal: 14, justifyContent: "center" },
  login: { minHeight: 48, borderRadius: 24, paddingHorizontal: 18, justifyContent: "center" },
  loginText: { fontSize: 15, fontWeight: "700" },
  sheet: {
    flexGrow: 1,
    marginTop: -56,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: 14,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  mark: { alignItems: "center", marginTop: -64, marginBottom: -26 },
  copy: { alignItems: "center", gap: 10, marginBottom: 6 },
  title: { fontSize: 36, lineHeight: 44, fontWeight: "900", letterSpacing: -1.1, textAlign: "center" },
  subtitle: { fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 300 },
  actions: { gap: 12 },
  email: {
    minHeight: 54,
    paddingVertical: 12,
    borderRadius: 27,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  emailText: { fontSize: 16, fontWeight: "700" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
