import { discard_related_note_drafts } from "../notes/draftStorage";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { VoticDocument } from "./types";
import { notification_player } from "../playback/notificationPlayback";
import * as Speech from "expo-speech";

export const DELETED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
function with_notes(document: VoticDocument, notes = document.savedPassages) {
  return {
    ...document,
    savedPassages: notes,
    ...(document.notebookKind === "quick-notes"
      ? {
          plainText: (notes || [])
            .filter((n) => !n.deletedAt)
            .map((n) => n.note)
            .join("\n\n"),
        }
      : {}),
  };
}
export function prune_deleted(documents: VoticDocument[], now = Date.now()) {
  const cutoff = now - DELETED_RETENTION_MS;
  return documents
    .filter((d) => !d.deletedAt || d.deletedAt > cutoff)
    .map((d) =>
      with_notes(
        d,
        d.savedPassages?.filter((n) => !n.deletedAt || n.deletedAt > cutoff),
      ),
    );
}
export async function expire_library(documents: VoticDocument[], uid?: string | null, now = Date.now()) {
  const cutoff = now - DELETED_RETENTION_MS;
  if (uid)
    for (const document of documents) {
      if (document.deletedAt && document.deletedAt <= cutoff)
        await discard_related_note_drafts(uid, document.id);
      else
        for (const note of document.savedPassages || []) {
          if (note.deletedAt && note.deletedAt <= cutoff)
            await discard_related_note_drafts(uid, document.id, note.id);
        }
    }
  return prune_deleted(documents, now);
}
export function live_library(documents: VoticDocument[]) {
  return documents
    .filter((d) => !d.deletedAt)
    .map((d) =>
      with_notes(
        d,
        d.savedPassages?.filter((n) => !n.deletedAt),
      ),
    );
}
export function useLibraryRecovery(
  documents: VoticDocument[],
  set: Dispatch<SetStateAction<VoticDocument[]>>,
  uid?: string | null,
) {
  const latest = useRef(documents);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    latest.current = documents;
  }, [documents]);
  useEffect(() => {
    const clean = () => {
      void expire_library(latest.current, uid)
        .then(() => {
          set((items) => prune_deleted(items));
          setError(null);
        })
        .catch(() =>
          setError("Some expired items could not be removed. Free device storage and reopen Votic to retry."),
        );
    };
    const timer = setInterval(clean, 60 * 60 * 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") clean();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [set, uid]);
  useEffect(() => {
    const state = notification_player()?.get_state();
    if (state?.documentId && documents.some((d) => d.id === state.documentId && d.deletedAt)) {
      void notification_player()?.stop();
      void Speech.stop();
    }
  }, [documents]);
  return {
    error,
    documents: documents.filter((d) => d.deletedAt),
    notes: documents
      .filter((d) => !d.deletedAt)
      .flatMap((document) =>
        (document.savedPassages || []).filter((p) => p.deletedAt).map((passage) => ({ document, passage })),
      ),
    restore(documentId: string, passageId?: string) {
      const document = latest.current.find((d) => d.id === documentId);
      const stamp = passageId
        ? document?.savedPassages?.find((n) => n.id === passageId)?.deletedAt
        : document?.deletedAt;
      if (stamp && stamp <= Date.now() - DELETED_RETENTION_MS) {
        setError("The 30-day recovery period has ended. This item can only be deleted permanently.");
        return;
      }
      set((items) =>
        items.map((d) => {
          if (d.id !== documentId) return d;
          return passageId
            ? with_notes(
                d,
                d.savedPassages?.map((p) => (p.id === passageId ? { ...p, deletedAt: undefined } : p)),
              )
            : { ...d, deletedAt: undefined };
        }),
      );
    },
    async permanentlyDelete(documentId: string, passageId?: string) {
      const document = latest.current.find((d) => d.id === documentId);
      const deleted = passageId
        ? document?.savedPassages?.some((n) => n.id === passageId && n.deletedAt)
        : document?.deletedAt;
      if (!deleted) return;
      if (uid) await discard_related_note_drafts(uid, documentId, passageId);
      set((items) =>
        (passageId
          ? items.map((d) =>
              d.id === documentId
                ? {
                    ...d,
                    savedPassages: d.savedPassages?.filter((p) => p.id !== passageId || !p.deletedAt),
                  }
                : d,
            )
          : items.filter((d) => d.id !== documentId || !d.deletedAt)
        ).map((d) => with_notes(d)),
      );
    },
  };
}
