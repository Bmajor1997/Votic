import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { report_ai_answer } from "../api/voticApi";
import { useVoticTheme } from "../theme/ThemeProvider";

const REASONS = [
  ["harmful", "Harmful or unsafe"],
  ["offensive", "Offensive content"],
  ["inaccurate", "Inaccurate or misleading"],
  ["other", "Other concern"],
] as const;

export function ReportAnswerButton({ answer }: { answer: string }) {
  const { theme } = useVoticTheme();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  function close() {
    if (!pending.current) setOpen(false);
  }
  async function submit() {
    if (!consent || !reason || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await report_ai_answer(answer, reason);
      setSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not send report. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const color = { color: theme.text };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sent ? "Answer reported" : "Report answer"}
        disabled={sent}
        onPress={() => setOpen(true)}
        style={s.action}
      >
        <Text style={{ color: theme.mutedText }}>{sent ? "Reported" : "Report"}</Text>
      </Pressable>
      <Modal visible={open} onRequestClose={close} animationType="none">
        <SafeAreaView accessibilityViewIsModal style={[s.fill, { backgroundColor: theme.background }]}>
          <ScrollView contentContainerStyle={s.content}>
            <Text accessibilityRole="header" style={[s.heading, color]}>
              {sent ? "Report received" : "Report this answer"}
            </Text>
            {sent ? (
              <Text accessibilityLiveRegion="polite" style={color}>
                Thank you. Your report is in Votic&apos;s private review queue.
              </Text>
            ) : (
              <>
                <Text style={color}>
                  Choose a reason. This shares up to 8,000 characters of this answer and your account
                  identifier with Votic for review. Your question and document are not attached. The answer
                  itself may quote your document.
                </Text>
                {REASONS.map(([value, label]) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: reason === value }}
                    disabled={busy}
                    onPress={() => setReason(value)}
                    style={[s.option, { borderColor: reason === value ? theme.accentText : theme.border }]}
                  >
                    <Text style={color}>{label}</Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="I consent to share this answer for review"
                  accessibilityState={{ checked: consent }}
                  disabled={busy}
                  onPress={() => setConsent(!consent)}
                  style={s.option}
                >
                  <Text style={color}>{consent ? "☑" : "☐"} I consent to share this answer for review</Text>
                </Pressable>
                {error ? (
                  <Text accessibilityRole="alert" style={color}>
                    {error}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !consent || !reason || busy }}
                  disabled={!consent || !reason || busy}
                  onPress={() => void submit()}
                  style={[s.option, { backgroundColor: theme.surfaceMuted }]}
                >
                  <Text style={color}>{busy ? "Sending report…" : "Send report"}</Text>
                </Pressable>
              </>
            )}
            <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={s.option}>
              <Text style={color}>{sent ? "Done" : "Cancel"}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: "700" },
  action: { minWidth: 44, minHeight: 44, justifyContent: "center" },
  option: { minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 10 },
});
