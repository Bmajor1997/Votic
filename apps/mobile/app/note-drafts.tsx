import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../src/components/BackHeader";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { useAccountData } from "../src/storage/AccountDataProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { discard_note_draft, load_note_drafts, RecoverableNote } from "../src/notes/draftStorage";
import { NoteEditor } from "../src/notes/components/NoteEditor";
import { note_from_draft } from "../src/notes/noteDraft";

export default function NoteDraftsScreen() {
  const { uid } = useAccountData();
  const { theme } = useVoticTheme();
  const library = useDocumentLibrary();
  const [drafts, setDrafts] = useState<RecoverableNote[]>([]);
  const [editing, setEditing] = useState<RecoverableNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    if (uid && !editing)
      void load_note_drafts(uid)
        .then((records) => {
          if (current) setDrafts(records);
        })
        .catch(() => setError("Could not read drafts. Try again after restarting Votic."));
    return () => {
      current = false;
    };
  }, [uid, editing]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <BackHeader title="Note drafts" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ color: theme.mutedText }}>
          Drafts are private to this account on this device. Review before saving. They are not included in
          library backups.
        </Text>
        {error ? (
          <Text accessibilityRole="alert" style={{ color: theme.text }}>
            {error}
          </Text>
        ) : null}
        {!drafts.length ? <Text style={{ color: theme.text }}>No unfinished notes</Text> : null}
        {drafts.map((record) => (
          <View
            key={JSON.stringify([record.item.document.id, record.item.passage.id])}
            style={{ padding: 16, gap: 8, backgroundColor: theme.surface }}
          >
            <Text numberOfLines={3} style={{ color: theme.text }}>
              {record.draft.title || record.draft.note || "Untitled draft"}
            </Text>
            <Text style={{ color: theme.mutedText }}>
              {record.item.document.title} · {new Date(record.updatedAt).toLocaleDateString()}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: "center" }}
              onPress={() => {
                const document = library.documents.find((d) => d.id === record.item.document.id);
                if (
                  (!document && record.item.document.id !== "new-quick-note") ||
                  library.recovery.notes.some(
                    (n) =>
                      n.document.id === record.item.document.id && n.passage.id === record.item.passage.id,
                  )
                ) {
                  Alert.alert(
                    "Restore the document first",
                    "The source document is unavailable. Restore it from Recently Deleted before resuming this draft.",
                  );
                  return;
                }
                setEditing({
                  ...record,
                  item: { ...record.item, document: document || record.item.document },
                });
              }}
            >
              <Text style={{ color: theme.accentText }}>Review draft</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: "center" }}
              onPress={() =>
                Alert.alert("Discard this draft?", "Your saved note will not change.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => {
                      if (uid)
                        void discard_note_draft(uid, record.item)
                          .then(() => setDrafts((items) => items.filter((r) => r !== record)))
                          .catch(() => setError("Could not discard draft. Try again."));
                    },
                  },
                ])
              }
            >
              <Text style={{ color: theme.text }}>Discard draft</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <NoteEditor
        item={editing?.item || null}
        onClose={() => setEditing(null)}
        onSave={(item, draft) => {
          const passage = note_from_draft(item.passage, draft);
          if (item.document.id === "new-quick-note") library.addQuickNote(passage);
          else library.savePassage(item.document.id, passage);
          setEditing(null);
        }}
      />
    </SafeAreaView>
  );
}
