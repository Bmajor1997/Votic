import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useActivity } from "../activity/ActivityProvider";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { useAccountData } from "../storage/AccountDataProvider";
import { notification_player } from "./notificationPlayback";
import { valid_native_events } from "./nativeActivity";

/** Reconciles two independently idempotent stores before acknowledging native checkpoints. */
export function NativeActivitySync() {
  const { uid } = useAccountData();
  const activity = useActivity();
  const library = useDocumentLibrary();
  const latest = useRef({ uid, activity, library });
  useEffect(() => {
    latest.current = { uid, activity, library };
  });
  useEffect(() => {
    const player = notification_player();
    if (!player?.activity_events) return;
    let running = false;
    let queued = false;
    let disposed = false;
    const reconcile = async () => {
      const current = latest.current;
      if (running) {
        queued = true;
        return;
      }
      if (disposed || !current.uid || !current.activity.hydrated || !current.library.loaded) return;
      running = true;
      try {
        const events = valid_native_events(player.activity_events!(current.uid), current.uid);
        if (!events.length) return;
        const documents = [...current.library.documents, ...current.library.recovery.documents];
        const pending = events.filter((e) => {
          const document = documents.find((d) => d.id === e.documentId);
          return (
            e.durationMs > (current.activity.measuredLog.nativeCheckpoints?.[e.id] || 0) ||
            Boolean(document && e.durationMs > (document.nativeCheckpoints?.[e.id] || 0))
          );
        });
        if (!pending.length) {
          await player.ack_activity?.(current.uid, JSON.stringify(events));
          return;
        }
        await current.activity.recordNativeActivity(events);
        if (disposed) return;
        await current.library.recordNativeActivity(events);
        if (!disposed) await player.ack_activity?.(current.uid, JSON.stringify(events));
      } catch {
        /* Durable native checkpoints remain pending until both stores succeed. */
      } finally {
        running = false;
        if (queued && !disposed) {
          queued = false;
          void reconcile();
        }
      }
    };
    const listener = player.addListener("state", () => void reconcile());
    const subscription = AppState.addEventListener("change", () => void reconcile());
    void reconcile();
    return () => {
      disposed = true;
      listener.remove();
      subscription.remove();
    };
  }, [uid, activity.hydrated, library.loaded]);
  return null;
}
