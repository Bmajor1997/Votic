import { useRef, useState } from "react";
import { Linking, Text } from "react-native";
import { SettingsRow } from "../settings/SettingsNavigation";
import { useVoticTheme } from "../theme/ThemeProvider";
import { VOTIC_FEEDBACK_FORM_URL } from "./feedbackLinks";

/** Open UserJot's public submission form in the user's browser on Android, iOS and web. */
export function FeedbackRow({ separated = false }: { separated?: boolean }) {
  const { theme } = useVoticTheme();
  const [error, setError] = useState<string | null>(null);
  const opening = useRef(false);
  async function open() {
    if (opening.current) return;
    opening.current = true;
    setError(null);
    try {
      await Linking.openURL(VOTIC_FEEDBACK_FORM_URL);
    } catch {
      setError("Couldn't open feedback. Please try again.");
    } finally {
      opening.current = false;
    }
  }
  return (
    <>
      <SettingsRow
        label="Share feedback"
        detail="Report a problem or suggest an improvement."
        hint="Opens Votic's feedback form in your browser"
        icon="chatbubble-ellipses-outline"
        separated={separated}
        onPress={() => void open()}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: theme.text, padding: 16 }}
        >
          {error}
        </Text>
      ) : null}
    </>
  );
}
