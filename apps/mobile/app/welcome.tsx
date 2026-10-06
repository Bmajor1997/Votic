import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthProvider";
import { SocialAuthButtons, useSocialAuth } from "../src/auth/SocialAuthButtons";
import { VoticLogo } from "../src/components/VoticLogo";
import { spacing } from "../src/design/tokens";
import { TextButton } from "../src/onboarding/components";
import { WelcomeArtwork } from "../src/onboarding/WelcomeArtwork";
import { useVoticTheme } from "../src/theme/ThemeProvider";

export default function Welcome() {
  const { theme } = useVoticTheme();
  const auth = useAuth();
  const social = useSocialAuth();
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <VoticLogo />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            disabled={social.busy !== null}
            accessibilityState={{ disabled: social.busy !== null }}
            onPress={() => router.push({ pathname: "/sign-in", params: { mode: "sign-in" } })}
            style={({ pressed }) => [
              s.login,
              { backgroundColor: pressed ? theme.surfaceMuted : theme.brandTint },
            ]}
          >
            <Text style={[s.loginText, { color: theme.accentText }]}>Sign in</Text>
          </Pressable>
        </View>
        <View style={s.art}>
          <WelcomeArtwork />
        </View>
        <View style={s.bottom}>
          <View style={s.copy}>
            <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
              Make room for{"\n"}what matters.
            </Text>
            <Text style={[s.subtitle, { color: theme.mutedText }]}>
              A place to read, listen, and keep your ideas.
            </Text>
          </View>
          <SocialAuthButtons
            busy={social.busy}
            onContinue={(provider) => void social.continueWith(provider)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with email"
            disabled={social.busy !== null}
            accessibilityState={{ disabled: social.busy !== null }}
            onPress={() => router.push("/sign-in")}
            style={({ pressed }) => [s.email, { backgroundColor: theme.accent, opacity: pressed ? 0.88 : 1 }]}
          >
            <Ionicons name="mail-outline" size={20} color="#FFF" />
            <Text style={s.emailText}>Continue with email</Text>
          </Pressable>
          {social.error ? (
            <Text accessibilityRole="alert" style={[s.message, { color: theme.text }]}>
              {social.error}
            </Text>
          ) : null}
          {!auth.configured ? (
            <View style={s.notice}>
              <Text style={[s.message, { color: theme.mutedText }]}>
                Account sign-in is unavailable in this preview.
              </Text>
              {auth.canContinueWithoutAccount ? (
                <TextButton
                  label="Continue without an account (development)"
                  onPress={auth.continueWithoutAccount}
                />
              ) : null}
            </View>
          ) : null}
          <Text style={[s.legal, { color: theme.mutedText }]}>
            By continuing, you agree to Votic&apos;s Terms and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  topBar: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  login: { minHeight: 48, borderRadius: 24, paddingHorizontal: 18, justifyContent: "center" },
  loginText: { fontSize: 15, fontWeight: "700" },
  art: { flexGrow: 1, justifyContent: "center", minHeight: 230, paddingVertical: 10 },
  bottom: { gap: 12 },
  copy: { alignItems: "center", gap: 10, marginBottom: 12 },
  title: { fontSize: 36, lineHeight: 40, fontWeight: "900", letterSpacing: -1.1, textAlign: "center" },
  subtitle: { fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 300 },
  email: {
    minHeight: 54,
    paddingVertical: 12,
    borderRadius: 27,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  emailText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  notice: { alignItems: "center" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  legal: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6 },
});
