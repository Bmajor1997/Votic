import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../src/accessibility/AccessibilityProvider";
import { BackHeader } from "../src/components/BackHeader";
import { spacing } from "../src/design/tokens";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { VoiceList } from "../src/voices/VoiceList";
import { useDeviceVoices } from "../src/voices/useDeviceVoices";
import { useVoicePreview } from "../src/voices/useVoicePreview";

/** Settings › Reading & Listening › Voice: the same voices as the Reader, chosen once for every document. */
export default function VoicesScreen() {
  const { theme } = useVoticTheme();
  const accessibility = useAccessibilityPreferences();
  const { voices, names, loaded } = useDeviceVoices();
  const preview = useVoicePreview();
  return (
    <SafeAreaView style={[s.fill, { backgroundColor: theme.background }]}>
      <BackHeader title="Voice" />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={[s.detail, { color: theme.mutedText }]}>
          Tap play to hear a voice, then choose the one that reads your documents, notes and answers.
        </Text>
        <VoiceList
          voices={voices}
          names={names}
          loaded={loaded}
          selected={accessibility.voiceIdentifier}
          previewing={preview.previewing}
          onPreview={(voice, name) => void preview.toggle(voice, name)}
          onSelect={(voice) => {
            preview.stop();
            accessibility.setVoiceIdentifier(voice.identifier);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  detail: { fontSize: 16, lineHeight: 24 },
});
