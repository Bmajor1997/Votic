import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useSubscription } from "../subscription/SubscriptionProvider";
import { useVoticTheme } from "../theme/ThemeProvider";

export function PolicyLinks() {
  const { legal } = useSubscription();
  const { theme } = useVoticTheme();
  const [error, setError] = useState("");
  async function open(url: string) {
    try {
      await Linking.openURL(url);
      setError("");
    } catch {
      setError("Could not open this policy. Check your connection and try again.");
    }
  }
  return (
    <View>
      {[
        ["Privacy Policy", legal.privacyUrl],
        ["Terms of Service", legal.termsUrl],
      ].map(([label, url]) =>
        url ? (
          <Pressable
            key={label}
            accessibilityRole="link"
            accessibilityLabel={label!}
            onPress={() => void open(url)}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <Text style={{ color: theme.linkText }}>{label}</Text>
          </Pressable>
        ) : null,
      )}
      {!legal.privacyUrl ? (
        <Text style={{ color: theme.mutedText }}>
          Policy links are unavailable. Please contact Votic support.
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.text }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
