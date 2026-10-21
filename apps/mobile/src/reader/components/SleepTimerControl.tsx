import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { notification_player } from "../../playback/notificationPlayback";
import { useVoticTheme } from "../../theme/ThemeProvider";

export function SleepTimerControl() {
  const { theme } = useVoticTheme();
  const [state, setState] = useState(() => notification_player()?.get_state());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const listener = notification_player()?.addListener("state", setState);
    return () => listener?.remove();
  }, []);
  const active = Boolean(state?.sleepDeadline || (state?.sleepPassage ?? -1) >= 0);
  const set = (seconds: number, boundary = false) =>
    void notification_player()
      ?.set_sleep_timer?.(seconds, boundary)
      .then(() => setOpen(false))
      .catch(() => Alert.alert("Timer unavailable", "Start a listening session, then set its timer."));
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={active ? "Active sleep timer. Change or cancel" : "Sleep timer"}
        style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center" }}
        onPress={() => {
          if (!notification_player()?.set_sleep_timer) {
            Alert.alert(
              "Sleep timer unavailable",
              "The timer needs Votic’s Android development or release build with native background playback.",
            );
            return;
          }
          setOpen(true);
        }}
      >
        <Text style={{ color: theme.accentText }}>
          {state?.sleepDeadline
            ? `Until ${new Date(state.sleepDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : active
              ? "End of passage"
              : "Sleep timer"}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <ScrollView
            accessibilityViewIsModal
            style={{ flexGrow: 0, backgroundColor: theme.surface, borderRadius: 20 }}
            contentContainerStyle={{ padding: 20, gap: 12 }}
          >
            <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 22 }}>
              Sleep timer
            </Text>
            <Text style={{ color: theme.mutedText }}>
              Duration includes pauses. Expiry pauses audio and never resumes it. Changing documents,
              completing playback, or the playback process restarting cancels the timer.
            </Text>
            {[15, 30, 60].map((minutes) => (
              <Pressable
                key={minutes}
                accessibilityRole="button"
                style={{ minHeight: 48, justifyContent: "center" }}
                onPress={() => set(minutes * 60)}
              >
                <Text style={{ color: theme.accentText }}>{minutes} minutes</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: "center" }}
              onPress={() => set(0, true)}
            >
              <Text style={{ color: theme.accentText }}>End of passage</Text>
            </Pressable>
            {active ? (
              <Pressable
                accessibilityRole="button"
                style={{ minHeight: 48, justifyContent: "center" }}
                onPress={() => set(0)}
              >
                <Text style={{ color: theme.accentText }}>Cancel timer</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: "center" }}
              onPress={() => setOpen(false)}
            >
              <Text style={{ color: theme.text }}>Close timer</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
