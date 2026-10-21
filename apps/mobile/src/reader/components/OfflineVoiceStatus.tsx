import { useEffect, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { notification_player } from "../../playback/notificationPlayback";
import { useVoticTheme } from "../../theme/ThemeProvider";

const messages = {
  offline:
    "Your device reports that this voice can work offline. Voice engines can still fail; test in airplane mode before relying on it.",
  network: "This voice requires a network connection. Choose or install an offline voice in device settings.",
  missing: "This voice or its language data is missing. Install the voice data or choose another voice.",
  unknown:
    "Offline voice availability could not be verified. Try airplane mode before relying on listening without a connection.",
};
export function OfflineVoiceStatus({ voice }: { voice?: string | null }) {
  const { theme } = useVoticTheme();
  const [status, setStatus] = useState<keyof typeof messages>("unknown");
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    const check = () => {
      setStatus("unknown");
      void notification_player()
        ?.voice_status?.(voice || null)
        .then((result) => {
          if (current && result.status in messages) setStatus(result.status as keyof typeof messages);
        })
        .catch(() => {
          if (current) setStatus("unknown");
        });
    };
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, [voice]);
  return (
    <View style={{ gap: 8, padding: 16, borderColor: theme.border, borderWidth: 1, borderRadius: 12 }}>
      <Text style={{ color: theme.text, fontWeight: "700" }}>Document saved on this device</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.mutedText }}>
        {messages[status]}
      </Text>
      {notification_player()?.open_voice_settings ? (
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 48, justifyContent: "center" }}
          onPress={() =>
            void notification_player()
              ?.open_voice_settings?.()
              .catch(() => setError(true))
          }
        >
          <Text style={{ color: theme.accentText }}>Device voice settings</Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.text }}>
          Open your phone’s Settings and search for text-to-speech to manage installed voice data.
        </Text>
      ) : null}
    </View>
  );
}
