import { useNoteDraftProtection } from "../useNoteDraftProtection";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { readable_title } from "../../documents/documentDisplay";
import { radii, spacing } from "../../design/tokens";
import { NoteType } from "../../documents/types";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { NOTE_TYPES } from "../noteMetadata";
import { NoteItem } from "../notesList";
import { notesSheetStyles as sheet } from "./notesSheetStyles";

export type NoteDraft = { note: string; title: string; noteType: NoteType; tags: string };

/** Adds or edits the note, title, type, and tags on a saved passage. */
export function NoteEditor({
  item,
  onClose,
  onSave,
}: {
  item: NoteItem | null;
  onClose: () => void;
  onSave: (item: NoteItem, draft: NoteDraft) => void;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const requestClose = useRef(onClose);
  return (
    <Modal
      visible={item !== null}
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={() => requestClose.current()}
    >
      {/* Keyed and mounted only while open, so each note starts from its own saved values. */}
      {item ? (
        <NoteEditorForm
          key={JSON.stringify([item.document.id, item.passage.id])}
          item={item}
          registerClose={(close) => {
            requestClose.current = close;
          }}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Modal>
  );
}

function NoteEditorForm({
  registerClose,
  item,
  onClose,
  onSave,
}: {
  registerClose: (close: () => void) => void;
  item: NoteItem;
  onClose: () => void;
  onSave: (item: NoteItem, draft: NoteDraft) => void;
}) {
  const { theme } = useVoticTheme();
  const { passage, document } = item;
  const [note, setNote] = useState(passage.note);
  const [title, setTitle] = useState(passage.title || "");
  const [noteType, setNoteType] = useState<NoteType>(passage.noteType || "note");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tags, setTags] = useState((passage.tags || []).join(", "));
  const protection = useNoteDraftProtection(
    item,
    { note, title, noteType, tags },
    (draft) => {
      setNote(draft.note);
      setTitle(draft.title);
      setNoteType(draft.noteType);
      setTags(draft.tags);
    },
    onClose,
  );
  useEffect(() => {
    registerClose(protection.close);
  });
  const saveDisabled = protection.saving || (!passage.text && !note.trim());
  const fieldColors = { color: theme.text, borderColor: theme.border, backgroundColor: theme.background };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[s.safe, { backgroundColor: theme.background }]}
    >
      <SafeAreaView accessibilityViewIsModal style={s.safe}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <View style={sheet.editorHeader}>
            <View style={sheet.editorCopy}>
              <Text style={[sheet.editorTitle, { color: theme.text }]}>
                {passage.note.trim() ? "Edit note" : passage.text ? "Add a note" : "Quick Note"}
              </Text>
              <Text numberOfLines={1} style={[sheet.editorDocument, { color: theme.mutedText }]}>
                {readable_title(document.title)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close note editor"
              disabled={protection.saving}
              onPress={protection.close}
              style={sheet.close}
            >
              <Ionicons name="close" size={23} color={theme.text} />
            </Pressable>
          </View>
          {passage.text ? (
            <Text
              numberOfLines={3}
              style={[s.excerpt, { color: theme.mutedText, backgroundColor: theme.surfaceMuted }]}
            >
              {passage.text}
            </Text>
          ) : null}
          {protection.error ? (
            <Text accessibilityRole="alert" style={{ color: theme.text }}>
              {protection.error}
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel="Note title"
            editable={!protection.saving}
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional — Votic can create one)"
            placeholderTextColor={theme.mutedText}
            maxLength={100}
            style={[s.field, fieldColors]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Note details"
            accessibilityState={{ expanded: detailsOpen }}
            onPress={() => setDetailsOpen(!detailsOpen)}
            style={s.details}
          >
            <Text style={{ color: theme.accentText, fontSize: 16, fontWeight: "700" }}>Type & tags</Text>
            <Ionicons name={detailsOpen ? "chevron-up" : "chevron-down"} size={20} color={theme.accentText} />
          </Pressable>
          {detailsOpen ? (
            <>
              <View style={s.typeRow}>
                {NOTE_TYPES.map((type) => {
                  const selected = noteType === type.value;
                  return (
                    <Pressable
                      key={type.value}
                      disabled={protection.saving}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setNoteType(type.value)}
                      style={[
                        s.typeChip,
                        {
                          borderColor: selected ? theme.accent : theme.border,
                          backgroundColor: selected ? theme.sentenceHighlight : theme.surface,
                        },
                      ]}
                    >
                      <Text style={[s.typeChipText, { color: selected ? theme.accentText : theme.text }]}>
                        {type.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                accessibilityLabel="Note tags"
                editable={!protection.saving}
                value={tags}
                onChangeText={setTags}
                placeholder="Tags, separated by commas"
                placeholderTextColor={theme.mutedText}
                maxLength={240}
                style={[s.field, fieldColors]}
              />
            </>
          ) : null}
          <TextInput
            autoFocus
            accessibilityLabel="Note text"
            editable={!protection.saving}
            value={note}
            onChangeText={setNote}
            placeholder="Write your note..."
            placeholderTextColor={theme.mutedText}
            multiline
            maxLength={2000}
            style={[s.noteInput, fieldColors]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save note"
            disabled={saveDisabled}
            accessibilityState={{ disabled: saveDisabled }}
            onPress={() => void protection.save(() => onSave(item, { note, title, noteType, tags }))}
            style={({ pressed }) => [s.save, { backgroundColor: theme.accent, opacity: pressed ? 0.78 : 1 }]}
          >
            <Text style={s.saveText}>{protection.saving ? "Saving…" : "Save note"}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md, width: "100%", maxWidth: 780, alignSelf: "center" },
  details: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  excerpt: { borderRadius: radii.md, padding: spacing.md, fontSize: 13, lineHeight: 19 },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  typeChip: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  typeChipText: { fontSize: 12, fontWeight: "700" },
  noteInput: {
    minHeight: 260,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: "top",
  },
  save: { minHeight: 50, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
