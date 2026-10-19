import { Linking, Pressable, Text, View } from "react-native";
import { VOTIC_FEEDBACK_FORM_URL } from "../feedback/feedbackLinks";
import { useEffect } from "react";
import { record_screen_failure } from "../storage/diagnostics";

/** Generic copy intentionally avoids showing/logging error messages that may quote private content. */
export function AppErrorScreen({ retry }: { retry: () => Promise<void> }) {
  useEffect(() => {
    void record_screen_failure();
  }, []);
  return (
    <View style={{ flex: 1, padding: 28, justifyContent: "center", backgroundColor: "#fff", gap: 20 }}>
      <Text accessibilityRole="header" style={{ fontSize: 24, color: "#172333" }}>
        Votic could not open this screen
      </Text>
      <Text style={{ color: "#172333" }}>
        Try opening it again. If it keeps happening, restart Votic or contact support.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry().catch(() => {})}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={{ color: "#124fa1" }}>Try again</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void Linking.openURL(VOTIC_FEEDBACK_FORM_URL).catch(() => {})}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={{ color: "#124fa1" }}>Contact support</Text>
      </Pressable>
    </View>
  );
}
