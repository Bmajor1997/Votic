import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { diagnostic_consent, set_diagnostic_consent } from "../storage/diagnostics";
import { useVoticTheme } from "../theme/ThemeProvider";
export function DiagnosticsSettings() {
  const { user } = useAuth();
  const { theme } = useVoticTheme();
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    if (user)
      void diagnostic_consent(user.uid)
        .then((value) => {
          if (current) setEnabled(value);
        })
        .catch(() => {});
    return () => {
      current = false;
    };
  }, [user]);
  if (!user) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>Share failure counts</Text>
      <Text style={{ color: theme.mutedText }}>
        Optional. Send a count when a Votic screen cannot open. No document text, notes, audio, error
        messages, or stack traces are sent. Counts are aggregated for up to 30 days. Turning this off clears
        pending counts on this device.
      </Text>
      <Switch
        accessibilityLabel="Share failure counts"
        value={enabled}
        onValueChange={(next) => {
          setError(false);
          void set_diagnostic_consent(user.uid, next)
            .then(() => setEnabled(next))
            .catch(() => setError(true));
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.text }}>
          Could not save this choice. Please try again.
        </Text>
      ) : null}
    </View>
  );
}
