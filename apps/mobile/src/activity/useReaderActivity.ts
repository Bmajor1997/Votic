import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { useActivity } from "./ActivityProvider";
import { TICK_MS, createSessionTracker } from "./sessionTracker";

type Tracker = ReturnType<typeof createSessionTracker>;

/**
 * Measures reading and listening while the Reader is open. Returns `engaged`, which the Reader
 * calls when someone scrolls, touches the page, or uses a control.
 */
export function useReaderActivity(documentId: string | null | undefined, playing: boolean) {
  const { recordTime } = useActivity();
  const { recordActivity } = useDocumentLibrary();
  // The tracker outlives renders, so it reads the latest recorders through a ref.
  const recorders = useRef({ recordTime, recordActivity });
  useEffect(() => {
    recorders.current = { recordTime, recordActivity };
  });
  const tracker = useRef<Tracker | null>(null);

  // Declared first so the tracker exists before the effects below send it state.
  useEffect(() => {
    // Per-document "time spent" (Reader summary, review) keeps whole seconds; carry the rest.
    const carry = new Map<string, number>();
    const created = createSessionTracker((id, kind, start, end) => {
      recorders.current.recordTime(id, kind, start, end);
      const ms = end - start + (carry.get(id) ?? 0);
      const seconds = Math.floor(ms / 1000);
      carry.set(id, ms - seconds * 1000);
      if (seconds > 0) recorders.current.recordActivity(id, seconds, kind === "listening" ? seconds : 0);
    });
    tracker.current = created;
    const interval = setInterval(() => created.tick(), TICK_MS);
    const subscription = AppState.addEventListener("change", (state) =>
      created.update({ appActive: state === "active" }),
    );
    return () => {
      clearInterval(interval);
      subscription.remove();
      created.stop();
      tracker.current = null;
    };
  }, []);
  useEffect(() => {
    tracker.current?.update({
      documentId: documentId ?? null,
      appActive: AppState.currentState !== "background",
    });
  }, [documentId]);
  useEffect(() => {
    tracker.current?.update({ playing });
  }, [playing]);

  return useCallback(() => tracker.current?.engaged(), []);
}
