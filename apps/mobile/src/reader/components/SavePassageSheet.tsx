import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
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
import { NoteType, SavedPassage } from "../../documents/types";
import { NOTE_TYPES } from "../../notes/noteMetadata";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { sheetStyles } from "./sheetStyles";

export type PassageDraft = { note: string; title: string; noteType: NoteType; tags: string };

/** Saves the current passage with an optional quick note, or edits/removes an existing one. */
export function SavePassageSheet({
  visible,
  passageText,
  savedPassage,
  onClose,
  onSave,
  onRemove,
}: {
  visible: boolean;
  passageText: string;
  savedPassage?: SavedPassage;
  onClose: () => void;
  onSave: (draft: PassageDraft) => void;
  onRemove: () => void;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      {/* Mounted only while open, so each opening starts from the saved passage's current values. */}
      {visible ? (
        <SavePassageForm
          passageText={passageText}
          savedPassage={savedPassage}
          onClose={onClose}
          onSave={onSave}
          onRemove={onRemove}
        />
      ) : null}
    </Modal>
  );
}

function SavePassageForm({
  passageText,
  savedPassage,
  onClose,
  onSave,
  onRemove,
}: {
  passageText: string;
  savedPassage?: SavedPassage;
  onClose: () => void;
  onSave: (draft: PassageDraft) => void;
  onRemove: () => void;
}) {
  const { theme } = useVoticTheme();
  const [note, setNote] = useState(savedPassage?.note || "");
  const [title, setTitle] = useState(savedPassage?.title || "");
  const [noteType, setNoteType] = useState<NoteType>(savedPassage?.noteType || "note");
  const [tags, setTags] = useState((savedPassage?.tags || []).join(", "));
  const fieldColors = { color: theme.text, borderColor: theme.border, backgroundColor: theme.background };
  return (
    <KeyboardAvoidingView
      style={sheetStyles.modalBackdrop}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close saved passage editor"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <View accessibilityViewIsModal style={[sheetStyles.sheet, { backgroundColor: theme.surface }]}>
        <View style={[sheetStyles.handle, { backgroundColor: theme.border }]} />
        <View style={sheetStyles.sheetHeader}>
          <View>
            <Text accessibilityRole="header" style={[sheetStyles.sheetTitle, { color: theme.text }]}>
              {savedPassage ? "Saved passage" : "Save passage"}
            </Text>
            <Text style={[sheetStyles.sheetSubtitle, { color: theme.mutedText }]}>
              Return to this moment from your document library.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close saved passage editor"
            onPress={onClose}
            style={sheetStyles.iconButton}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        <Text
          numberOfLines={4}
          style={[s.excerpt, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
        >
          {passageText}
        </Text>
        <Text style={[sheetStyles.settingLabel, { color: theme.mutedText }]}>QUICK NOTE — OPTIONAL</Text>
        <TextInput
          accessibilityLabel="Quick note title"
          value={title}
          onChangeText={setTitle}
          placeholder="Title (optional)"
          placeholderTextColor={theme.mutedText}
          maxLength={100}
          style={[s.field, fieldColors]}
        />
        <View style={s.types}>
          {NOTE_TYPES.map((item) => {
            const selected = noteType === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setNoteType(item.value)}
                style={[
                  s.type,
                  {
                    borderColor: selected ? theme.accent : theme.border,
                    backgroundColor: selected ? theme.sentenceHighlight : theme.surface,
                  },
                ]}
              >
                <Text style={[s.typeText, { color: selected ? theme.accent : theme.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          accessibilityLabel="Quick note tags"
          value={tags}
          onChangeText={setTags}
          placeholder="Tags, separated by commas"
          placeholderTextColor={theme.mutedText}
          maxLength={240}
          style={[s.field, fieldColors]}
        />
        <TextInput
          accessibilityLabel="Note about saved passage"
          value={note}
          onChangeText={setNote}
          placeholder="Why do you want to remember this?"
          placeholderTextColor={theme.mutedText}
          multiline
          maxLength={500}
          style={[s.noteInput, fieldColors]}
        />
        <View style={s.actions}>
          {savedPassage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove saved passage"
              onPress={onRemove}
              style={({ pressed }) => [
                s.removeButton,
                { borderColor: theme.border, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text style={[s.removeText, { color: theme.text }]}>Remove</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={savedPassage ? "Update saved passage" : "Save passage"}
            onPress={() => onSave({ note, title, noteType, tags })}
            style={({ pressed }) => [
              s.saveButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <Text style={s.saveText}>{savedPassage ? "Update" : "Save"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  excerpt: {
    fontSize: 16,
    lineHeight: 24,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  field: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  types: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  type: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  typeText: { fontSize: 12, fontWeight: "700" },
  noteInput: {
    minHeight: 104,
    maxHeight: 180,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: "top",
    marginTop: spacing.sm,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.lg },
  removeButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { ...typography.control },
  saveButton: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  saveText: { ...typography.control, color: "#FFF" },
});
