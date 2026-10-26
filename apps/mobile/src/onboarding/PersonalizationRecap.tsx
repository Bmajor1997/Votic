import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { EXPLANATION_STYLES, PURPOSES, useVoticPurpose } from "../personalization/PurposeProvider";
import { format_playback_rate } from "../playback/rates";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useDeviceVoices } from "../voices/useDeviceVoices";

/** Shows actual saved preferences, including defaults when questions were skipped. */
export function PersonalizationRecap() {
  const { theme } = useVoticTheme();
  const a = useAccessibilityPreferences();
  const { purpose, explanationStyle, defaultPlaybackRate } = useVoticPurpose();
  const { names } = useDeviceVoices();
  const reading = [
    a.textSize === "default" ? "Standard text" : a.textSize === "large" ? "Large text" : "Extra large text",
    a.readerFont === "accessible" ? "accessible font" : "system font",
    a.readingSpacing === "extra"
      ? "extra line spacing"
      : a.readingSpacing === "compact"
        ? "compact line spacing"
        : null,
    a.textSpacing === "wide" ? "wider letter spacing" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const rows = [
    { icon: "document-text-outline" as const, title: "Your reading", detail: reading },
    {
      icon: "headset-outline" as const,
      title: "Your listening",
      detail: `${names[a.voiceIdentifier ?? ""] ?? "Device voice"} · ${format_playback_rate(defaultPlaybackRate)} · ${a.highlightMode === "off" ? "no highlighting" : a.highlightMode === "sentence" ? "sentence highlights" : a.highlightMode === "word" ? "word highlights" : "word and sentence highlights"}`,
    },
    {
      icon: "sparkles-outline" as const,
      title: "Your explanations",
      detail:
        EXPLANATION_STYLES.find((style) => style.value === explanationStyle)?.label ??
        "Adapt to the question",
    },
  ];
  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[s.eyebrow, { color: theme.accentText }]}>SET UP AROUND YOU</Text>
      {purpose ? (
        <Text style={[s.purpose, { color: theme.text }]}>
          {PURPOSES.find((item) => item.value === purpose)?.label}
        </Text>
      ) : null}
      {rows.map((row) => (
        <View key={row.title} accessible accessibilityLabel={`${row.title}. ${row.detail}`} style={s.row}>
          <View style={[s.icon, { backgroundColor: theme.brandTint }]}>
            <Ionicons name={row.icon} size={21} color={theme.accentText} />
          </View>
          <View style={s.copy}>
            <Text style={[s.title, { color: theme.text }]}>{row.title}</Text>
            <Text style={[s.detail, { color: theme.mutedText }]}>{row.detail}</Text>
          </View>
        </View>
      ))}
      <Text style={[s.detail, { color: theme.mutedText }]}>You can change these anytime in Settings.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 20 },
  eyebrow: { fontSize: 12, lineHeight: 18, letterSpacing: 1, fontWeight: "700" },
  purpose: { fontSize: 23, lineHeight: 30, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  detail: { fontSize: 14, lineHeight: 21 },
});
