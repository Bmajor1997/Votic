import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { useAccountData } from "../storage/AccountDataProvider";
import { discard_note_draft, load_note_drafts, save_note_draft } from "./draftStorage";
import type { NoteDraft } from "./components/NoteEditor";
import type { NoteItem } from "./notesList";

export function useNoteDraftProtection(
  item: NoteItem,
  draft: NoteDraft,
  restore: (draft: NoteDraft) => void,
  onClose: () => void,
) {
  const { uid, registerFlush } = useAccountData();
  const { flush } = useDocumentLibrary();
  const [saving, setSaving] = useState(false);
  const initial = useRef(JSON.stringify(draft));
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  });
  const finished = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const persist = useRef(async () => {});
  useEffect(() => {
    persist.current = async () => {
      if (!uid || finished.current || initial.current === JSON.stringify(latest.current)) return;
      try {
        await save_note_draft(uid, item, latest.current);
        setError(null);
      } catch {
        setError("Your draft could not be saved. Keep this editor open and save your note.");
        throw new Error("Draft save failed.");
      }
    };
  });
  useEffect(() => {
    let current = true;
    if (uid)
      void load_note_drafts(uid)
        .then((records) => {
          const record = records.find(
            (r) => r.item.document.id === item.document.id && r.item.passage.id === item.passage.id,
          );
          if (current && record && initial.current === JSON.stringify(latest.current)) restore(record.draft);
        })
        .catch(() => setError("Saved drafts could not be read. Your existing note is unchanged."));
    return () => {
      current = false;
      void persist.current().catch(() => {});
    };
    // This editor is keyed by the account and passage; hydrate once before edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, item.document.id, item.passage.id]);
  useEffect(() => {
    const timer = setTimeout(() => void persist.current().catch(() => {}), 350);
    return () => clearTimeout(timer);
  }, [draft.note, draft.title, draft.noteType, draft.tags]);
  useEffect(() => registerFlush(() => persist.current()), [registerFlush]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", () => void persist.current().catch(() => {}));
    return () => subscription.remove();
  }, []);
  async function clear() {
    finished.current = true;
    try {
      if (uid) await discard_note_draft(uid, item);
    } catch {
      finished.current = false;
      throw new Error("The saved draft could not be cleared. Please try again.");
    }
  }
  return {
    error,
    clear,
    saving,
    async save(commit: () => void | Promise<void>) {
      if (saving) return;
      setSaving(true);
      try {
        await persist.current();
        await commit();
        await flush();
        await clear();
      } catch {
        Alert.alert(
          "Note save incomplete",
          "Your recoverable draft has been kept. Review it in Settings → Help → Note drafts and retry saving.",
        );
      } finally {
        setSaving(false);
      }
    },
    close() {
      if (saving) return;
      if (initial.current === JSON.stringify(latest.current)) {
        onClose();
        return;
      }
      Alert.alert(
        "Keep this note draft?",
        "Your saved note will stay unchanged until you choose Save note.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard draft",
            style: "destructive",
            onPress: () =>
              void clear()
                .then(onClose)
                .catch((e) => setError(e.message)),
          },
          {
            text: "Keep draft",
            onPress: () =>
              void persist
                .current()
                .then(() => {
                  if (!finished.current) onClose();
                })
                .catch(() => {}),
          },
        ],
      );
    },
  };
}
