import { Pressable, Text, View } from "react-native";
import { remember_feedback_form } from "../feedback/feedbackNavigation";
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
        onPress={() => {
          remember_feedback_form("bug");
          void retry().catch(() => {});
        }}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={{ color: "#124fa1" }}>Reopen and report a bug</Text>
      </Pressable>
    </View>
  );
}
