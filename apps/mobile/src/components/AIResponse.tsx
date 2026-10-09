import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { ShimmerText } from "./ShimmerText";
import { RevealingText } from "./RevealingText";
import { revealCompletedText, type TextRevealFrame } from "./textReveal";
import { useVoticTheme } from "../theme/ThemeProvider";

/** Reveal completed answers in reading order; the complete answer remains available to assistive technology. */
export function AIResponse({
  text,
  style,
  animate = true,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  animate?: boolean;
}) {
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
    return revealCompletedText(text, { onFrame: setFrame, onComplete: () => {} });
  }, [text, reduceMotion, animate, skipped]);
  return (
    <View style={s.response}>
      {!complete ? (
        <View style={s.statusRow}>
          <AIStatus label="Revealing response…" />
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
export function AIThinking({ summary = false }: { summary?: boolean }) {
  return <AIStatus label={summary ? "Thinking about your summary…" : "Thinking…"} />;
}

export function AIStatus({ label, compact = false }: { label: string; compact?: boolean }) {
  const { theme } = useVoticTheme();
  return (
    <View style={[s.thinking, compact && s.compact]}>
      {!compact && (
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <Ionicons name="sparkles-outline" size={16} color={theme.aiStatusText} />
        </View>
      )}
      <ShimmerText text={label.replace(/…$/, "")} accessibilityLabel={label} style={s.aiStatus} />
      <Text
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[s.aiStatus, { color: theme.mutedText }]}
      >
        …
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  response: { gap: 4 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, flexShrink: 1 },
  compact: { minHeight: 20 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  status: { fontSize: 13 },
  aiStatus: { fontSize: 13, lineHeight: 20, fontWeight: "400", letterSpacing: 0.1, flexShrink: 1 },
  skip: { minHeight: 48, paddingHorizontal: 8, justifyContent: "center" },
});
