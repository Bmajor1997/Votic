import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { split_passages } from "../documents/passages";
import { create_throttled_saver } from "../documents/throttledSaver";
import { progress_for_location } from "../reader/readerText";
import { useAccountData } from "../storage/AccountDataProvider";
import { useSubscription } from "../subscription/SubscriptionProvider";
import {
  notification_player,
  valid_playback_state,
  type NotificationPlaybackState,
} from "./notificationPlayback";

/** Lives above the Reader so notification commands still save progress after that screen closes. */
export function NotificationPlaybackSync() {
  const { uid } = useAccountData();
  const library = useDocumentLibrary();
  const { access, checking } = useSubscription();
  // While Votic is still confirming Premium at launch, access is unknown, not lost: never stop narration then.
  const denied = !access && !checking;
  const latest = useRef({ uid, library, access, denied });
  useEffect(() => {
    latest.current = { uid, library, access, denied };
  });
  const sync = useRef<(state: Partial<NotificationPlaybackState>) => void>(() => {});

  useEffect(() => {
    const player = notification_player();
    if (!player) return;
    let cached: { id: string; text: string; passages: string[] } | null = null;
    let completed: string | null = null;
    const saver = create_throttled_saver<NotificationPlaybackState>((state) => {
      const { uid: accountId, library: current, access: allowed } = latest.current;
      if (!allowed || !valid_playback_state(state, accountId)) return;
      const doc = current.documents.find((item) => item.id === state.documentId);
      if (!doc) return;
      if (!cached || cached.id !== doc.id || cached.text !== doc.plainText)
        cached = { id: doc.id, text: doc.plainText, passages: split_passages(doc.plainText) };
      if (state.completed) {
        if (completed !== doc.id) {
          completed = doc.id;
          current.completeDocument(doc.id, state.passageIndex, state.wordIndex);
        }
      } else {
        completed = null;
        current.updateProgress(
          doc.id,
          progress_for_location(cached.passages, state.passageIndex, state.wordIndex),
          state.passageIndex,
          state.wordIndex,
        );
      }
    }, 1000);
    const receive = (state: Partial<NotificationPlaybackState>) => {
      const current = latest.current;
      if (!state.documentId) return;
      if (!current.denied && !current.access) return;
      if (
        !valid_playback_state(state, current.uid) ||
        current.denied ||
        (current.library.loaded && !current.library.documents.some((item) => item.id === state.documentId))
      ) {
        void player.stop().catch(() => {});
        return;
      }
      if (!current.library.loaded) return;
      saver.schedule(state);
      if (!state.playing) void saver.flush();
    };
    sync.current = receive;
    const listener = player.addListener("state", receive);
    receive(player.get_state());
    const appState = AppState.addEventListener("change", (state) => {
      // JS may have been suspended while the native service moved through several passages.
      receive(player.get_state());
      if (state !== "active") void saver.flush();
    });
    return () => {
      sync.current = () => {};
      listener.remove();
      appState.remove();
      void saver.flush();
    };
  }, []);

  useEffect(() => {
    if (!library.loaded) return;
    const frame = requestAnimationFrame(() => {
      const state = notification_player()?.get_state();
      if (state) sync.current(state);
    });
    return () => cancelAnimationFrame(frame);
  }, [library.loaded, uid, access, denied]);

  useEffect(() => {
    const player = notification_player();
    const state = player?.get_state();
    if (
      state?.documentId &&
      (denied ||
        !valid_playback_state(state, uid) ||
        (library.loaded && !library.documents.some((doc) => doc.id === state.documentId)))
    )
      void player?.stop().catch(() => {});
  }, [uid, denied, library.loaded, library.documents]);
  const activeDocumentId = library.activeDocument?.id;
  useEffect(() => {
    const player = notification_player();
    const state = player?.get_state();
    if (state?.documentId && activeDocumentId && state.documentId !== activeDocumentId)
      void player?.set_sleep_timer?.(0, false).catch(() => {});
  }, [activeDocumentId]);
  return null;
}
