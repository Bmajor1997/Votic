import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { PlaybackSpeedControl } from "../../components/PlaybackSpeedControl";
import { radii, spacing, typography } from "../../design/tokens";
import { AppearanceMode, useVoticTheme } from "../../theme/ThemeProvider";
import { DeviceVoice, voticVoiceName } from "../voices";
import { Choice, Setting, VoiceChoice } from "./ReaderControls";
import { sheetStyles } from "./sheetStyles";

export type ReaderSheet = "appearance" | "focus" | "listen" | null;

const SHEET_COPY = {
  appearance: { title: "Appearance", subtitle: "Changes appear in the document immediately." },
  focus: { title: "Reading focus", subtitle: "Choose the guidance that helps you track the text." },
  listen: { title: "Listen", subtitle: "Choose a voice and comfortable listening speed." },
} as const;

/** The Reader's Appearance, Reading focus, and Listen controls, shown as a bottom sheet. */
export function ReaderSettingsSheet({
  sheet,
  onClose,
  rate,
  onRateChange,
  voices,
  previewVoiceIdentifier,
  onPreviewVoice,
  onSelectVoice,
}: {
  sheet: ReaderSheet;
  onClose: () => void;
  rate: number;
  onRateChange: (rate: number) => void;
  voices: DeviceVoice[];
  previewVoiceIdentifier: string | null;
  /** Starts or stops a preview of the voice at this position in `voices`. */
  onPreviewVoice: (voice: DeviceVoice, voiceIndex: number) => void;
  onSelectVoice: (voice: DeviceVoice) => void;
}) {
  const { theme, appearanceMode, setAppearanceMode } = useVoticTheme();
  const accessibility = useAccessibilityPreferences();
  const copy = sheet ? SHEET_COPY[sheet] : SHEET_COPY.listen;
  return (
    <Modal
      visible={sheet !== null}
      transparent
      animationType={accessibility.reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close reader controls"
        onPress={onClose}
        style={sheetStyles.modalBackdrop}
      >
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={[sheetStyles.sheet, { backgroundColor: theme.surface }]}
        >
          <View style={[sheetStyles.handle, { backgroundColor: theme.border }]} />
          <View style={sheetStyles.sheetHeader}>
            <View>
              <Text accessibilityRole="header" style={[sheetStyles.sheetTitle, { color: theme.text }]}>
                {copy.title}
              </Text>
              <Text style={[sheetStyles.sheetSubtitle, { color: theme.mutedText }]}>{copy.subtitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close reader controls"
              onPress={onClose}
              style={sheetStyles.iconButton}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetContent}>
            {sheet === "appearance" ? (
              <>
                <Setting label="Text size">
                  <Choice
                    label="A"
                    value="default"
                    current={accessibility.textSize}
                    onChange={accessibility.setTextSize}
                  />
                  <Choice
                    label="A+"
                    value="large"
                    current={accessibility.textSize}
                    onChange={accessibility.setTextSize}
                  />
                  <Choice
                    label="A++"
                    value="extra-large"
                    current={accessibility.textSize}
                    onChange={accessibility.setTextSize}
                  />
                </Setting>
                <Setting label="Font">
                  <Choice
                    label="Votic Sans"
                    value="system"
                    current={accessibility.readerFont}
                    onChange={accessibility.setReaderFont}
                  />
                  <Choice
                    label="Serif"
                    value="serif"
                    current={accessibility.readerFont}
                    onChange={accessibility.setReaderFont}
                  />
                  <Choice
                    label="Accessible"
                    value="accessible"
                    current={accessibility.readerFont}
                    onChange={accessibility.setReaderFont}
                  />
                </Setting>
                <Setting label="Theme">
                  <Choice
                    label="Light"
                    value="light"
                    current={appearanceMode}
                    onChange={(value: AppearanceMode) => setAppearanceMode(value)}
                  />
                  <Choice
                    label="Dark"
                    value="dark"
                    current={appearanceMode}
                    onChange={(value: AppearanceMode) => setAppearanceMode(value)}
                  />
                  <Choice
                    label="Device"
                    value="system"
                    current={appearanceMode}
                    onChange={(value: AppearanceMode) => setAppearanceMode(value)}
                  />
                </Setting>
                <Setting label="Line spacing">
                  <Choice
                    label="Compact"
                    value="compact"
                    current={accessibility.readingSpacing}
                    onChange={accessibility.setReadingSpacing}
                  />
                  <Choice
                    label="Comfortable"
                    value="default"
                    current={accessibility.readingSpacing}
                    onChange={accessibility.setReadingSpacing}
                  />
                  <Choice
                    label="Open"
                    value="extra"
                    current={accessibility.readingSpacing}
                    onChange={accessibility.setReadingSpacing}
                  />
                </Setting>
                <Setting label="Text spacing">
                  <Choice
                    label="Standard"
                    value="default"
                    current={accessibility.textSpacing}
                    onChange={accessibility.setTextSpacing}
                  />
                  <Choice
                    label="Wide"
                    value="wide"
                    current={accessibility.textSpacing}
                    onChange={accessibility.setTextSpacing}
                  />
                </Setting>
              </>
            ) : null}
            {sheet === "focus" ? (
              <>
                <Setting label="Spoken-text highlight">
                  <Choice
                    label="Off"
                    value="off"
                    current={accessibility.highlightMode}
                    onChange={accessibility.setHighlightMode}
                  />
                  <Choice
                    label="Sentence"
                    value="sentence"
                    current={accessibility.highlightMode}
                    onChange={accessibility.setHighlightMode}
                  />
                  <Choice
                    label="Word"
                    value="word"
                    current={accessibility.highlightMode}
                    onChange={accessibility.setHighlightMode}
                  />
                  <Choice
                    label="Both"
                    value="both"
                    current={accessibility.highlightMode}
                    onChange={accessibility.setHighlightMode}
                  />
                </Setting>
                <View style={[s.toggleRow, { borderColor: theme.border }]}>
                  <View style={s.toggleCopy}>
                    <Text style={[s.toggleTitle, { color: theme.text }]}>Emphasize current word</Text>
                    <Text style={[s.toggleDescription, { color: theme.mutedText }]}>
                      Adds weight and size as Votic reads.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Emphasize current word"
                    value={accessibility.wordEmphasis}
                    onValueChange={accessibility.setWordEmphasis}
                    trackColor={{ true: theme.accent }}
                  />
                </View>
              </>
            ) : null}
            {sheet === "listen" ? (
              <>
                <PlaybackSpeedControl rate={rate} onChange={onRateChange} />
                <Setting label="Voice">
                  {voices.length ? (
                    voices.map((voice, voiceIndex) => (
                      <VoiceChoice
                        key={voice.identifier}
                        name={voticVoiceName(voiceIndex)}
                        selected={accessibility.voiceIdentifier === voice.identifier}
                        previewing={previewVoiceIdentifier === voice.identifier}
                        onPreview={() => onPreviewVoice(voice, voiceIndex)}
                        onSelect={() => onSelectVoice(voice)}
                      />
                    ))
                  ) : (
                    <Text style={[s.emptyVoices, { color: theme.mutedText }]}>
                      Your device voice will be used.
                    </Text>
                  )}
                </Setting>
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheetContent: { paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  toggleRow: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  toggleCopy: { flex: 1 },
  toggleTitle: { ...typography.control },
  toggleDescription: { fontSize: 13, marginTop: 2 },
  emptyVoices: { fontSize: 14, paddingVertical: spacing.sm },
});
