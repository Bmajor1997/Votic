import { ActivityLog, add_interval, day_key } from "../activity/activityModel";
import { VoticDocument } from "../documents/types";

export type NativeActivityEvent = {
  id: string;
  accountId: string;
  documentId: string;
  start: number;
  durationMs: number;
};
export function valid_native_events(events: NativeActivityEvent[], uid: string) {
  return events.filter(
    (e) =>
      e.accountId === uid &&
      typeof e.id === "string" &&
      e.id.length <= 500 &&
      typeof e.documentId === "string" &&
      e.documentId.length <= 200 &&
      Number.isFinite(e.start) &&
      e.start > 0 &&
      e.start <= Date.now() + 86_400_000 &&
      Number.isFinite(e.durationMs) &&
      e.durationMs >= 0 &&
      e.durationMs <= 3_600_000,
  );
}
/** Events must be the full outstanding native snapshot; acknowledged counters can be forgotten safely. */
export function reconcile_native_log(log: ActivityLog, events: NativeActivityEvent[]) {
  let next = log;
  const ids = new Set(events.map((e) => e.id));
  const checkpoints = Object.fromEntries(
    Object.entries(log.nativeCheckpoints || {}).filter(([id]) => ids.has(id)),
  );
  for (const event of events) {
    const prior = checkpoints[event.id] || 0;
    if (event.durationMs <= prior) continue;
    next = add_interval(
      next,
      event.documentId,
      "listening",
      event.start + prior,
      event.start + event.durationMs,
    );
    checkpoints[event.id] = event.durationMs;
  }
  return { ...next, nativeCheckpoints: checkpoints };
}
export function reconcile_native_documents(documents: VoticDocument[], events: NativeActivityEvent[]) {
  return documents.map((document) => {
    const ids = new Set(events.map((e) => e.id));
    const checkpoints = Object.fromEntries(
      Object.entries(document.nativeCheckpoints || {}).filter(([id]) => ids.has(id)),
    );
    const activity = { ...document.activity };
    for (const event of events) {
      if (event.documentId !== document.id) continue;
      const prior = checkpoints[event.id] || 0;
      if (event.durationMs <= prior) continue;
      // Use the same local-hour splitting as Statistics, then aggregate into document days.
      const interval = add_interval(
        { version: 1, trackingStartedAt: event.start, buckets: {}, ask: [] },
        document.id,
        "listening",
        event.start + prior,
        event.start + event.durationMs,
      );
      for (const [hour, values] of Object.entries(interval.buckets)) {
        const day = hour.slice(0, 10) || day_key(new Date(event.start));
        const seconds = values[document.id].listening / 1000;
        const before = activity[day] || { readingSeconds: 0, listeningSeconds: 0 };
        activity[day] = {
          readingSeconds: before.readingSeconds + seconds,
          listeningSeconds: before.listeningSeconds + seconds,
        };
      }
      checkpoints[event.id] = event.durationMs;
    }
    return { ...document, activity, nativeCheckpoints: checkpoints };
  });
}
