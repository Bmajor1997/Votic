import { editorial } from "../src/design/editorial";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../src/components/VoticLogo";
import { spacing } from "../src/design/tokens";
import { LegalLine, NotConfiguredNotice, SocialSignIn } from "../src/onboarding/accountForms";
import { useIntro } from "../src/onboarding/IntroProvider";
import { BrandMark, useMarkFlight } from "../src/onboarding/WelcomeMotion";
import { useVoticTheme } from "../src/theme/ThemeProvider";

/**
 * The first screen: the Votic logo, the V over a soft blue glow, then the headline and the ways in.
 * Apple and Google create the account or sign in; "Create account" opens the email form; the bold "Sign in →" under
 * "Already have an account?" is for existing email accounts. The screen stands still until someone taps one of them, when the V's
 * wings fly off to the right one by one and its stroke flies up and away; then Create account or Sign in opens, or
 * Google's account picker. A tap while the V is flying does nothing.
 */
export default function Welcome() {
  const { theme } = useVoticTheme();
  const [socialBusy, setSocialBusy] = useState(false);
  const [error, setError] = useState("");
  const mark = useMarkFlight();
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
        {/* Drawn after the top bar so the V's pieces pass over it as they leave. */}
        <View style={s.art}>
          <BrandMark size={140} flight={mark.flight} />
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
          <SocialSignIn
            on_busy_change={setSocialBusy}
            onError={setError}
            // The V flies off as for Sign in, then Google's account picker opens; if it's closed or fails, the V
            // comes back together and the screen is ready again.
            before_google={mark.fly_away}
            after_google_stopped={mark.land}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create account"
            accessibilityHint="With your email address"
            disabled={socialBusy}
            accessibilityState={{ disabled: socialBusy }}
            onPress={() => mark.fly(() => router.push("/create-account"))}
            style={({ pressed }) => [
              s.create,
              { backgroundColor: theme.accent, opacity: socialBusy ? 0.55 : pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={[s.createText, { color: theme.onAccent }]}>Create account</Text>
          </Pressable>
          {/* Text, not a third big button, so Google and Create account lead; still a full-size touch area. */}
          <View style={s.returning}>
            <Text style={[s.returningText, { color: theme.mutedText }]}>Already have an account?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              accessibilityHint="For an existing Votic account"
              disabled={socialBusy}
              accessibilityState={{ disabled: socialBusy }}
              onPress={() => mark.fly(() => router.push("/sign-in"))}
              hitSlop={8}
              style={({ pressed }) => [s.signIn, { opacity: socialBusy ? 0.55 : pressed ? 0.7 : 1 }]}
            >
              <Text style={[s.signInText, { color: theme.accentText }]}>Sign in</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.accentText} />
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
  art: { flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: 240, paddingVertical: 10 },
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
  returning: { alignItems: "center", marginTop: 4 },
  returningText: { fontSize: 15, lineHeight: 21, textAlign: "center" },
  signIn: {
    minHeight: 48,
    minWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  signInText: { fontSize: 19, lineHeight: 25, fontWeight: "700" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
