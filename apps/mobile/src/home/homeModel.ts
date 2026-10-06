/**
 * What Home shows, decided from data Votic already keeps: the library (documents, progress, notes) and the
 * activity log (reading and listening time). Nothing here stores anything of its own.
 */
import { ActivityLog, chartSeries, dayKey, insights, periodFor, summarize } from "../activity/activityModel";
import { SavedPassage, VoticDocument } from "../documents/types";

export type ResumeMode = "listen" | "read";

/** The last hour a document was read or listened to, and which it mostly was then. */
export function lastSession(log: ActivityLog, documentId: string): { mode: ResumeMode; at: number } | null {
  let latestKey = "";
  for (const [key, hour] of Object.entries(log.buckets)) {
    const split = hour[documentId];
    if (split && split.reading + split.listening > 0 && key > latestKey) latestKey = key;
  }
  if (!latestKey) return null;
  const split = log.buckets[latestKey][documentId];
  const [year, month, day] = latestKey.slice(0, 10).split("-").map(Number);
  return {
    mode: split.listening > split.reading ? "listen" : "read",
    at: new Date(year, month - 1, day, Number(latestKey.slice(11))).getTime(),
  };
}

/**
 * How to resume a document: the way it was last used. A document never measured falls back to how the
 * person has used Votic over the last 30 days, and to reading when there's nothing to go on.
 */
export function resumeModeFor(log: ActivityLog, documentId: string, now = new Date()): ResumeMode {
  const last = lastSession(log, documentId);
  if (last) return last.mode;
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const recent = summarize(log, since, now);
  return recent.total > 0 && recent.listening > recent.reading ? "listen" : "read";
}

export type WeekActivity = {
  total: number;
  reading: number;
  listening: number;
  /** Monday to Sunday, reading plus listening per day. */
  days: { label: string; longLabel: string; total: number; isToday: boolean }[];
  /** Change from last week, only when both weeks have enough activity for a percentage to mean something. */
  change: number | null;
};

export function weekActivity(log: ActivityLog, now = new Date()): WeekActivity {
  const week = periodFor("week", 0, now);
  const summary = summarize(log, week.start, week.end);
  const today = dayKey(now);
  const days = chartSeries(log, week, now).map((point) => ({
    label: point.label,
    longLabel: point.longLabel,
    total: point.reading + point.listening,
    isToday: point.key === today,
  }));
  return {
    total: summary.total,
    reading: summary.reading,
    listening: summary.listening,
    days,
    change: insights(log, week, now).comparison?.change ?? null,
  };
}

/** "Up 18% from last week" / "Down 5% from last week" / "Same as last week". */
export function changeLabel(change: number) {
  const percent = Math.round(Math.abs(change) * 100);
  if (percent === 0) return "Same as last week";
  return `${change > 0 ? "Up" : "Down"} ${percent}% from last week`;
}

/**
 * One factual sentence about how Votic has been used, or null when there isn't enough activity for it to
 * be true in a meaningful way. Never invented: every sentence comes from measured time or finished documents.
 */
export function homeInsight(log: ActivityLog, documents: VoticDocument[], now = new Date()): string | null {
  const month = periodFor("month", 0, now);
  const finished = documents.filter(
    (document) =>
      document.completedAt &&
      document.completedAt >= month.start.getTime() &&
      document.completedAt < month.end.getTime(),
  ).length;
  if (finished >= 2) return `You've finished ${finished} documents this month.`;
  const week = insights(log, periodFor("week", 0, now), now);
  if (!week.enough) return null;
  if (week.listeningShare >= 0.65) return "Most of your time with Votic this week was listening.";
  if (week.listeningShare <= 0.35) return "Most of your time with Votic this week was reading.";
  if (week.mostActiveTime)
    return week.mostActiveTime.id === "night"
      ? "You've been most active at night this week."
      : `You've been most active in the ${week.mostActiveTime.label.toLowerCase()} this week.`;
  return null;
}

export type NoteItem = { document: VoticDocument; passage: SavedPassage };

/** Notes worth revisiting from Home: pinned first, then the most recently changed. */
export function homeNotes(documents: VoticDocument[], limit = 6): NoteItem[] {
  return documents
    .flatMap((document) => (document.savedPassages || []).map((passage) => ({ document, passage })))
    .sort(
      (a, b) =>
        Number(Boolean(b.passage.pinned)) - Number(Boolean(a.passage.pinned)) ||
        b.passage.updatedAt - a.passage.updatedAt,
    )
    .slice(0, limit);
}

/** "Today", "Yesterday", "3 days ago", or a short date. */
export function relativeDay(time: number, now = new Date()) {
  const start = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((start(now) - start(new Date(time))) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
