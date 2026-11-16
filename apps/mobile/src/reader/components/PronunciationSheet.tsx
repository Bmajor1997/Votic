import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { radii, spacing, typography } from "../../design/tokens";
import { normalize_playback_rate } from "../../playback/rates";
import { useVoticTheme } from "../../theme/ThemeProvider";
import {
  find_pronunciation,
  load_pronunciations,
  normalize_pronunciation_entry,
  PronunciationEntry,
  save_pronunciations,
  term_from_word,
  with_pronunciation,
} from "../pronunciationDictionary";
import { sheetStyles } from "./sheetStyles";

/**
 * This account's pronunciations, and which held word is being taught, if any. Opening it from a held word first pauses narration (`before_open`), so the
 * preview can be heard and the new pronunciation is used when listening resumes.
 */
export function usePronunciationEditor(uid: string | null | undefined, before_open: () => void) {
  const [entries, setEntries] = useState<PronunciationEntry[]>([]);
  const [word, setWord] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void load_pronunciations(uid).then((value) => {
      if (current) setEntries(value);
    });
    return () => {
      current = false;
    };
  }, [uid]);
  const open = (held: string | undefined) => {
    const term = term_from_word(held ?? "");
    if (!term || !uid) return;
    before_open();
    setWord(term);
  };
  const close = useCallback(() => setWord(null), []);
  return { entries, set_entries: setEntries, word, open, close };
}

/** Opened by pressing and holding a word in the Reader: teach Votic how to say it, hear it, and save it. */
export function PronunciationSheet({
  visible,
  word,
  uid,
  entries,
  playbackRate,
  on_close,
  on_saved,
}: {
  visible: boolean;
  word: string;
  uid: string;
  entries: PronunciationEntry[];
  playbackRate: number;
  on_close: () => void;
  on_saved: (entries: PronunciationEntry[]) => void;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={on_close}
    >
      {/* Mounted only while open, so each opening starts from the word that was pressed. */}
      {visible ? (
        <PronunciationForm
          word={word}
          uid={uid}
          entries={entries}
          playbackRate={playbackRate}
          on_close={on_close}
          on_saved={on_saved}
        />
      ) : null}
    </Modal>
  );
}

function PronunciationForm({
  word,
  uid,
  entries,
  playbackRate,
  on_close,
  on_saved,
}: {
  word: string;
  uid: string;
  entries: PronunciationEntry[];
  playbackRate: number;
  on_close: () => void;
  on_saved: (entries: PronunciationEntry[]) => void;
}) {
  const { theme } = useVoticTheme();
  const { voiceIdentifier } = useAccessibilityPreferences();
  const existing = find_pronunciation(entries, word);
  const [term, setTerm] = useState(existing?.term ?? word);
  const [pronunciation, setPronunciation] = useState(existing?.pronunciation ?? "");
  const [saving, setSaving] = useState(false);
  const saved = find_pronunciation(entries, term);
  const fieldColors = { color: theme.text, borderColor: theme.border, backgroundColor: theme.background };

  useEffect(() => () => void Speech.stop(), []);

  function preview() {
    const spoken = pronunciation.trim() || term.trim();
    if (!spoken) return;
    void Speech.stop();
    Speech.speak(spoken, {
      voice: voiceIdentifier || undefined,
      rate: normalize_playback_rate(playbackRate),
    });
  }
  async function store(next: PronunciationEntry[], failure: string) {
    setSaving(true);
    try {
      await save_pronunciations(uid, next);
      on_saved(next);
      on_close();
    } catch (error) {
      Alert.alert(failure, error instanceof Error ? error.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }
  function save() {
    try {
      const entry = normalize_pronunciation_entry(term, pronunciation);
      void store(with_pronunciation(entries, entry), "Could not save pronunciation");
    } catch (error) {
      Alert.alert("Could not save pronunciation", error instanceof Error ? error.message : "Try again.");
    }
  }
  function remove() {
    if (!saved) return;
    void store(
      entries.filter((item) => item.id !== saved.id),
      "Could not remove pronunciation",
    );
  }

  return (
    <KeyboardAvoidingView
      style={sheetStyles.modalBackdrop}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close pronunciation"
        onPress={on_close}
        style={StyleSheet.absoluteFill}
      />
      <View accessibilityViewIsModal style={[sheetStyles.sheet, { backgroundColor: theme.surface }]}>
        <View style={[sheetStyles.handle, { backgroundColor: theme.border }]} />
        <View style={sheetStyles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[sheetStyles.sheetTitle, { color: theme.text }]}>
              Fix how it&apos;s said
            </Text>
            <Text style={[sheetStyles.sheetSubtitle, { color: theme.mutedText }]}>
              Votic will say it your way whenever it reads aloud. The text on the page stays the same.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close pronunciation"
            onPress={on_close}
            style={sheetStyles.iconButton}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        <Text style={[sheetStyles.settingLabel, s.label, { color: theme.mutedText }]}>Word</Text>
        <TextInput
          accessibilityLabel="Word or phrase"
          value={term}
          onChangeText={setTerm}
          autoCorrect={false}
          maxLength={120}
          style={[s.field, fieldColors]}
        />
        <Text style={[sheetStyles.settingLabel, s.label, { color: theme.mutedText }]}>Say it as</Text>
        <TextInput
          accessibilityLabel="How Votic should say it"
          value={pronunciation}
          onChangeText={setPronunciation}
          placeholder="For example: VOH-tick"
          placeholderTextColor={theme.mutedText}
          autoCorrect={false}
          autoFocus
          maxLength={180}
          returnKeyType="done"
          onSubmitEditing={save}
          style={[s.field, fieldColors]}
        />
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Preview pronunciation"
            onPress={preview}
            style={({ pressed }) => [s.secondary, { borderColor: theme.border, opacity: pressed ? 0.65 : 1 }]}
          >
            <Ionicons name="volume-high-outline" size={20} color={theme.text} />
            <Text style={[s.secondaryText, { color: theme.text }]}>Preview</Text>
          </Pressable>
          {saved ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Remove pronunciation for " + saved.term}
              disabled={saving}
              onPress={remove}
              style={({ pressed }) => [
                s.secondary,
                { borderColor: theme.border, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text style={[s.secondaryText, { color: theme.text }]}>Remove</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save pronunciation"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={save}
            style={({ pressed }) => [s.save, { backgroundColor: theme.accent, opacity: pressed ? 0.78 : 1 }]}
          >
            <Text style={s.saveText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  label: { marginTop: spacing.lg },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    marginTop: spacing.sm,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  secondary: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { ...typography.control },
  save: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  saveText: { ...typography.control, color: "#FFF" },
});
