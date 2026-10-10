import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "./AuthProvider";
import { SignInCancelled, authErrorMessage } from "./authErrors";
import { useVoticTheme } from "../theme/ThemeProvider";

export type SocialProvider = "apple" | "google";
/** The same account flow creates new users or restores an existing account. */
export function useSocialAuth() {
  const auth = useAuth();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState("");
  async function continueWith(provider: SocialProvider) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setBusy(provider);
    try {
      if (provider === "apple") await auth.signInWithApple();
      else await auth.signInWithGoogle();
    } catch (failure) {
      if (!(failure instanceof SignInCancelled)) setError(authErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  return { busy, error, setError, continueWith };
}

export function SocialAuthButtons({
  busy,
  disabled = false,
  onContinue,
}: {
  busy: SocialProvider | null;
  disabled?: boolean;
  onContinue: (provider: SocialProvider) => void;
}) {
  const auth = useAuth();
  const { theme } = useVoticTheme();
  const blocked = disabled || busy !== null;
  return (
    <View style={s.options}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityHint={
          auth.googleAvailable
            ? "Sign in or create an account with your Google account, including Gmail"
            : "Google sign-in is unavailable in this preview"
        }
        accessibilityState={{ disabled: blocked || !auth.googleAvailable, busy: busy === "google" }}
        disabled={blocked || !auth.googleAvailable}
        onPress={() => onContinue("google")}
        style={({ pressed }) => [
          s.button,
          { backgroundColor: pressed ? theme.surfaceMuted : theme.surface, borderColor: theme.border },
        ]}
      >
        {busy === "google" ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <Ionicons name="logo-google" size={20} color={theme.text} />
        )}
        <Text style={[s.label, { color: auth.googleAvailable ? theme.text : theme.mutedText }]}>
          Continue with Google
        </Text>
      </Pressable>
      {auth.appleAvailable ? (
        <View
          accessibilityState={{ disabled: blocked, busy: busy === "apple" }}
          style={s.appleWrap}
          pointerEvents={blocked ? "none" : "auto"}
        >
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              theme.isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={27}
            style={s.apple}
            onPress={() => {
              if (!blocked) onContinue("apple");
            }}
          />
          {busy === "apple" ? (
            <View
              pointerEvents="none"
              style={s.appleBusy}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Signing in with Apple"
            >
              <ActivityIndicator color={theme.isDark ? "#111" : "#FFF"} />
            </View>
          ) : null}
        </View>
      ) : null}
      {!auth.googleAvailable && auth.configured ? (
        <Text style={[s.availability, { color: theme.mutedText }]}>
          {Platform.OS === "web"
            ? "Google and Apple sign-in are available in the configured mobile app."
            : "Google sign-in is not available in this build."}
        </Text>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  options: { gap: 10 },
  button: {
    minHeight: 54,
    borderRadius: 27,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  label: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  appleWrap: { minHeight: 54 },
  apple: { height: 54, width: "100%" },
  appleBusy: { position: "absolute", right: 18, top: 0, bottom: 0, justifyContent: "center" },
  availability: { fontSize: 13, lineHeight: 19, textAlign: "center" },
});
