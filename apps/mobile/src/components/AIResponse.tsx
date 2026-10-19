import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { ShimmerText } from "./ShimmerText";
import { RevealingText } from "./RevealingText";
import { lay_down_text, readable_ai_text, type TextRevealFrame } from "./textReveal";
import { useVoticTheme } from "../theme/ThemeProvider";
import { ask_status } from "../ask/askStatus";
import { VoticPulse } from "./animations/VoticPulse";

/** Reveal completed answers in reading order; the complete answer remains available to assistive technology. */
export function AIResponse({
  text: raw,
  style,
  animate = true,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  animate?: boolean;
}) {
  const text = readable_ai_text(raw);
  const { reduceMotion } = useAccessibilityPreferences();
  const { theme } = useVoticTheme();
  const [frame, setFrame] = useState<TextRevealFrame>({
    text,
    visible: "",
    highlightStart: 0,
    complete: false,
  });
  const [skippedText, setSkippedText] = useState<string | null>(null);
  const skipped = skippedText === text;
  const complete = reduceMotion || !animate || skipped || (frame.text === text && frame.complete);
  useEffect(() => {
    if (reduceMotion || !animate || skipped) return;
    return lay_down_text(text, { onFrame: setFrame, onComplete: () => {} });
  }, [text, reduceMotion, animate, skipped]);
  return (
    <View style={s.response}>
      {!complete ? (
        <View style={s.statusRow}>
          <AIStatus label="Writing" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show full response"
            onPress={() => setSkippedText(text)}
            style={s.skip}
          >
            <Text style={[s.status, { color: theme.accentText }]}>Show all</Text>
          </Pressable>
        </View>
      ) : null}
      {reduceMotion || !animate || skipped ? (
        <Text selectable accessibilityLabel={text} style={style}>
          {text}
        </Text>
      ) : (
        <RevealingText
          frame={frame.text === text ? frame : { text, visible: "", highlightStart: 0, complete: false }}
          style={style}
        />
      )}
    </View>
  );
}
export function AIThinking({
  summary = false,
  question = "",
  grounded = false,
}: {
  summary?: boolean;
  question?: string;
  grounded?: boolean;
}) {
  return <AIStatus label={summary ? "Summarizing" : ask_status(question, grounded)} />;
}

/** Text-only status labels share the blue-to-violet shimmer. */
export function AIStatus({ label, compact = false }: { label: string; compact?: boolean }) {
  const text = label.replace(/(?:…|\.\.\.)$/, "");
  return (
    <View style={[s.thinking, compact && s.compact]}>
      {!compact ? <VoticPulse active size={18} /> : null}
      <ShimmerText key={text} text={text} accessibilityLabel={text} style={s.aiStatus} />
    </View>
  );
}
const s = StyleSheet.create({
  response: { gap: 4 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, flexShrink: 1 },
  compact: { minHeight: 20 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  status: { fontSize: 13 },
  aiStatus: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0.1, flexShrink: 1 },
  skip: { minHeight: 48, paddingHorizontal: 8, justifyContent: "center" },
});
