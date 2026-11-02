import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { spacing } from "../design/tokens";
import { useAuth } from "../auth/AuthProvider";
import { diagnostic_consent, set_diagnostic_consent } from "../storage/diagnostics";
import { useVoticTheme } from "../theme/ThemeProvider";
/** The switch's name, also its accessibility label. */
export const AUTOMATIC_REPORTS_LABEL = "Send automatic problem reports";

/**
 * Optional, anonymous problem reports: when a Votic screen fails to open, a count is sent so it can be fixed.
 * Lives in Feedback, next to the other ways of telling Votic about problems.
 */
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
    <View style={{ gap: spacing.sm, padding: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Text style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: "700" }}>
          {AUTOMATIC_REPORTS_LABEL}
        </Text>
        <Switch
          accessibilityLabel={AUTOMATIC_REPORTS_LABEL}
          value={enabled}
          onValueChange={(next) => {
            setError(false);
            void set_diagnostic_consent(user.uid, next)
              .then(() => setEnabled(next))
              .catch(() => setError(true));
          }}
        />
      </View>
      <Text style={{ color: theme.mutedText, fontSize: 15, lineHeight: 22 }}>
        If a Votic screen ever fails to open, let Votic know automatically so it can be fixed. Only the fact
        that it happened is sent: never your documents, notes, recordings or anything you type. Off unless you
        turn it on.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.text }}>
          Could not save this choice. Please try again.
        </Text>
      ) : null}
    </View>
  );
}
