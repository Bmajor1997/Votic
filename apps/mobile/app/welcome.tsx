import { editorial } from "../src/design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../src/components/VoticLogo";
import { spacing } from "../src/design/tokens";
import { LegalLine, NotConfiguredNotice, SocialSignIn } from "../src/onboarding/accountForms";
import { BrandMark, useMarkFlight } from "../src/onboarding/WelcomeMotion";
import { useVoticTheme } from "../src/theme/ThemeProvider";

/**
 * The first screen. Apple and Google create the account or sign in; "Create account with email" creates a new
 * account; the full-width "Sign in" below it is for existing email accounts. The screen stands still until someone
 * taps Sign in, when the V's wings fly off to the right one by one and its stroke flies up and away.
 */
export default function Welcome() {
  const { theme } = useVoticTheme();
  const [socialBusy, setSocialBusy] = useState(false);
  const [error, setError] = useState("");
  const mark = useMarkFlight();
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <VoticLogo />
        </View>
        {/* Drawn after the top bar so the V's pieces pass over it as they leave. */}
        <View style={s.art}>
          <BrandMark size={112} flight={mark.flight} />
        </View>
        <View style={s.bottom}>
          <View style={s.copy}>
            <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
              Make room for{"\n"}
              <Text style={{ color: theme.accentText }}>what matters.</Text>
            </Text>
            <Text style={[s.subtitle, { color: theme.mutedText }]}>
              A place to read, listen, and keep your ideas.
            </Text>
          </View>
          <SocialSignIn
            onBusyChange={(busy) => {
              if (busy) mark.cancel();
              setSocialBusy(busy);
            }}
            onError={setError}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create account with email"
            disabled={socialBusy}
            accessibilityState={{ disabled: socialBusy }}
            onPress={() => {
              mark.cancel();
              router.push("/create-account");
            }}
            style={({ pressed }) => [s.email, { backgroundColor: theme.accent, opacity: pressed ? 0.88 : 1 }]}
          >
            <Ionicons name="mail-outline" size={20} color={theme.onAccent} />
            <Text style={[s.emailText, { color: theme.onAccent }]}>Create account with email</Text>
          </Pressable>
          {/* Existing accounts get a full-size choice of their own, so Sign in is never mistaken for sign-up. */}
          <Text style={[s.returning, { color: theme.mutedText }]}>Already have an account?</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityHint="For an existing Votic account"
            disabled={socialBusy}
            accessibilityState={{ disabled: socialBusy }}
            onPress={() => mark.fly(() => router.push("/sign-in"))}
            style={({ pressed }) => [
              s.signIn,
              { borderColor: theme.accent, backgroundColor: pressed ? theme.surfaceMuted : theme.background },
            ]}
          >
            <Ionicons name="log-in-outline" size={20} color={theme.accentText} />
            <Text style={[s.signInText, { color: theme.accentText }]}>Sign in</Text>
          </Pressable>
          {error ? (
            <Text accessibilityRole="alert" style={[s.message, { color: theme.text }]}>
              {error}
            </Text>
          ) : null}
          <NotConfiguredNotice />
          <LegalLine />
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
  art: { flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: 210, paddingVertical: 10 },
  bottom: { gap: 12 },
  copy: { alignItems: "center", gap: 10, marginBottom: 12 },
  title: { ...editorial, fontSize: 38, lineHeight: 44, textAlign: "center" },
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
  emailText: { fontSize: 16, fontWeight: "700" },
  returning: { fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: 8 },
  signIn: {
    minHeight: 54,
    paddingVertical: 12,
    borderRadius: 27,
    borderWidth: 2,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  signInText: { fontSize: 16, fontWeight: "700" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
