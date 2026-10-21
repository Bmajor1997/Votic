import { OfflineVoiceStatus } from "./OfflineVoiceStatus";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { PlaybackSpeedControl } from "../../components/PlaybackSpeedControl";
import { radii, spacing, typography } from "../../design/tokens";
import { ReaderAppearanceMode, useVoticTheme } from "../../theme/ThemeProvider";
import { DeviceVoice, votic_voice_names } from "../voices";
import { Choice, Setting, VoiceChoice } from "./ReaderControls";
import { sheetStyles } from "./sheetStyles";

export type ReaderSheet = "text" | "color" | "focus" | "listen" | null;

const SHEET_COPY = {
  text: { title: "Text", subtitle: "Size, font, and spacing. Changes appear in the document immediately." },
  color: {
    title: "Color",
    subtitle: "The page color and contrast. Changes appear in the document immediately.",
  },
  focus: { title: "Reading focus", subtitle: "Choose the guidance that helps you track the text." },
  listen: { title: "Listen", subtitle: "Choose a voice and comfortable listening speed." },
} as const;

/**
 * The Reader's Text, Color, Reading focus, and Listen controls, shown as a bottom sheet. Text and Color share the
 * same saved preferences as Settings › Reading & Listening and Accessibility, so a change in one shows in the other.
 */
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
  onPreviewVoice: (voice: DeviceVoice, name: string) => void;
  onSelectVoice: (voice: DeviceVoice) => void;
}) {
  const { theme, appearanceMode, setReaderAppearanceMode } = useVoticTheme();
  const accessibility = useAccessibilityPreferences();
  const voiceNames = votic_voice_names(voices);
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
            {sheet === "text" ? (
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
            {sheet === "color" ? (
              <>
                <Setting label="Theme">
                  <Choice
                    label="Light"
                    value="light"
                    current={appearanceMode}
                    onChange={(value: ReaderAppearanceMode) => setReaderAppearanceMode(value)}
                  />
                  <Choice
                    label="Dark"
                    value="dark"
                    current={appearanceMode}
                    onChange={(value: ReaderAppearanceMode) => setReaderAppearanceMode(value)}
                  />
                  <Choice
                    label="Sepia"
                    value="sepia"
                    current={appearanceMode}
                    onChange={(value: ReaderAppearanceMode) => setReaderAppearanceMode(value)}
                  />
                </Setting>
                <View style={[s.toggleRow, { borderColor: theme.border }]}>
                  <View style={s.toggleCopy}>
                    <Text style={[s.toggleTitle, { color: theme.text }]}>High contrast</Text>
                    <Text style={[s.toggleDescription, { color: theme.mutedText }]}>
                      Darker text and clearer borders on the page, in any theme.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="High contrast"
                    accessibilityHint="Makes the document text and borders stronger"
                    value={accessibility.highContrast}
                    onValueChange={accessibility.setHighContrast}
                    trackColor={{ true: theme.accent }}
                  />
                </View>
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
                <OfflineVoiceStatus voice={accessibility.voiceIdentifier} />
                <PlaybackSpeedControl rate={rate} onChange={onRateChange} />
                <Setting label="Voice">
                  {voices.length ? (
                    voices.map((voice) => {
                      const name = voiceNames[voice.identifier];
                      return (
                        <VoiceChoice
                          key={voice.identifier}
                          name={name}
                          selected={accessibility.voiceIdentifier === voice.identifier}
                          previewing={previewVoiceIdentifier === voice.identifier}
                          onPreview={() => onPreviewVoice(voice, name)}
                          onSelect={() => onSelectVoice(voice)}
                        />
                      );
                    })
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
  offlineCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
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
