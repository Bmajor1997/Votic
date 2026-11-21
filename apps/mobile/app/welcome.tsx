import { editorial } from "../src/design/editorial";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../src/components/VoticLogo";
import { spacing } from "../src/design/tokens";
import { LegalLine, NotConfiguredNotice, SocialSignIn } from "../src/onboarding/accountForms";
import { BookHero } from "../src/onboarding/BookHero";
import { useIntro } from "../src/onboarding/IntroProvider";
import { useVoticTheme, WelcomeDark } from "../src/theme/ThemeProvider";

/**
 * The first screen, always dark: the Votic logo, an open book whose pages turn to the page being read, then the
 * headline and the ways in. Apple and Google create the account or sign in; "Create account" opens the email form;
 * "Already have an account? Sign in" is for existing email accounts. Every button works straight away.
 */
export default function Welcome() {
  return (
    <WelcomeDark>
      <WelcomeScreen />
    </WelcomeDark>
  );
}

function WelcomeScreen() {
  const { theme } = useVoticTheme();
  const [socialBusy, setSocialBusy] = useState(false);
  const [error, setError] = useState("");
  const { intro } = useIntro();
  // Straight after the tour: "Create my account" lands here, and "I already have an account" opens Sign in.
  const fromTour = intro.toured && intro.entry === "create" && !intro.claimedBy;
  const sentToSignIn = useRef(false);
  useEffect(() => {
    if (!intro.toured || intro.entry !== "sign-in" || sentToSignIn.current) return;
    sentToSignIn.current = true;
    router.push("/sign-in");
  }, [intro.toured, intro.entry]);
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <VoticLogo />
        </View>
        <View style={s.art}>
          <BookHero />
        </View>
        <View style={s.bottom}>
          <View style={s.copy}>
            {fromTour ? (
              <>
                <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
                  Create your{"\n"}
                  <Text style={[s.titleAccent, { color: theme.accentText }]}>account.</Text>
                </Text>
                <Text style={[s.subtitle, { color: theme.mutedText }]}>
                  Your choices from the tour are saved to it.
                </Text>
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
                  Make room for{"\n"}
                  <Text style={[s.titleAccent, { color: theme.accentText }]}>what matters.</Text>
                </Text>
                <Text style={[s.subtitle, { color: theme.mutedText }]}>
                  A place to read, listen, and keep your ideas.
                </Text>
              </>
            )}
          </View>
          <SocialSignIn on_busy_change={setSocialBusy} onError={setError} white_google />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create account"
            accessibilityHint="With your email address"
            disabled={socialBusy}
            accessibilityState={{ disabled: socialBusy }}
            onPress={() => router.push("/create-account")}
            style={({ pressed }) => [
              s.create,
              { backgroundColor: theme.accent, opacity: socialBusy ? 0.55 : pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={[s.createText, { color: theme.onAccent }]}>Create account</Text>
          </Pressable>
          {/* One line, but "Sign in" is its own button with a full-size touch area. */}
          <View style={s.returningRow}>
            <Text style={[s.returning, { color: theme.mutedText }]}>Already have an account?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              accessibilityHint="For an existing Votic account"
              disabled={socialBusy}
              accessibilityState={{ disabled: socialBusy }}
              onPress={() => router.push("/sign-in")}
              hitSlop={12}
              style={({ pressed }) => [s.signIn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[s.signInText, { color: theme.text }]}>Sign in</Text>
            </Pressable>
          </View>
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
  topBar: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  // The book runs to the screen's edges; its picture fades into the background on every side.
  art: { flexGrow: 1, justifyContent: "center", marginHorizontal: -spacing.xl, minHeight: 220 },
  bottom: { gap: 12 },
  copy: { alignItems: "center", gap: 10, marginBottom: 12 },
  title: { ...editorial, fontSize: 38, lineHeight: 44, textAlign: "center" },
  titleAccent: { fontStyle: "italic" },
  subtitle: { fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 300 },
  create: {
    minHeight: 56,
    paddingVertical: 12,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  createText: { fontSize: 16, fontWeight: "700" },
  returningRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  returning: { fontSize: 15, lineHeight: 21 },
  signIn: { minHeight: 48, justifyContent: "center", paddingHorizontal: 4 },
  signInText: { fontSize: 15, lineHeight: 21, fontWeight: "700", textDecorationLine: "underline" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
