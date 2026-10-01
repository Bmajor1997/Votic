import { ActivityKind } from "./activityModel";

/** Reading pauses after two minutes without scrolling, touching, or using a control. */
export const READING_IDLE_MS = 2 * 60_000;
/**
 * The Reader checks in every 10 seconds. A longer gap means the app was suspended (for example the
 * phone locked without a background event), so that gap is not counted as reading or listening.
 */
export const TICK_MS = 10_000;
export const SUSPENDED_GAP_MS = 3 * TICK_MS;
const ENGAGEMENT_REFRESH_MS = 5_000;

type Recorder = (documentId: string, kind: ActivityKind, start: number, end: number) => void;
export type TrackerInput = { documentId: string | null; appActive: boolean; playing: boolean };

/**
 * Turns Reader state into measured time:
 * - listening while narration is playing and the app is in the foreground (elapsed time, so speed
 *   and pauses are reflected),
 * - otherwise reading, but only within two minutes of the last interaction,
 * - never both at once: time while listening is listening only.
 */
export function createSessionTracker(record: Recorder, now: () => number = Date.now) {
  let input: TrackerInput = { documentId: null, appActive: true, playing: false };
  let lastEngaged = -Infinity;
  let lastSync = now();
  let segment: { kind: ActivityKind; documentId: string; start: number } | null = null;

  function kindAt(at: number): ActivityKind | null {
    if (!input.documentId || !input.appActive) return null;
    if (input.playing) return "listening";
    return at - lastEngaged < READING_IDLE_MS ? "reading" : null;
  }
  function commit(at: number) {
    // After a suspension, count only up to the last check-in before it.
    const suspended = at - lastSync > SUSPENDED_GAP_MS;
    const ceiling = suspended ? lastSync : at;
    if (segment) {
      const end = segment.kind === "reading" ? Math.min(ceiling, lastEngaged + READING_IDLE_MS) : ceiling;
      if (end > segment.start) record(segment.documentId, segment.kind, segment.start, end);
    }
    if (suspended) lastEngaged = Math.min(lastEngaged, lastSync);
    lastSync = at;
    segment = null;
  }
  function open(at: number) {
    const kind = kindAt(at);
    segment = kind && input.documentId ? { kind, documentId: input.documentId, start: at } : null;
  }

  return {
    /** Called on a timer and whenever Reader state changes. */
    update(next: Partial<TrackerInput>) {
      const at = now();
      commit(at);
      const stoppedPlaying = input.playing && next.playing === false;
      const opened = next.documentId && next.documentId !== input.documentId;
      input = { ...input, ...next };
      // People keep reading where narration stopped, and opening a document is engagement.
      if (stoppedPlaying || opened) lastEngaged = at;
      open(at);
    },
    /** Scrolling, touching the page, or using a control. */
    engaged() {
      const at = now();
      if (segment?.kind === "reading" && at - lastEngaged < ENGAGEMENT_REFRESH_MS) {
        lastEngaged = at;
        return;
      }
      commit(at);
      lastEngaged = at;
      open(at);
    },
    tick() {
      const at = now();
      commit(at);
      open(at);
    },
    /** Ends measurement, e.g. when the Reader closes. */
    stop() {
      commit(now());
      input = { ...input, documentId: null };
    },
  };
}
