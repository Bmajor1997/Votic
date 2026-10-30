import { VoticDocument } from "./types";

const WORDS_PER_MINUTE = 200;

export function estimated_minutes_remaining(document: VoticDocument) {
  const totalWords = document.plainText.match(/\S+/g)?.length || 0;
  const remainingWords = Math.max(0, Math.round(totalWords * (1 - document.progress)));
  return Math.max(
    remainingWords ? 1 : 0,
    Math.ceil(remainingWords / (WORDS_PER_MINUTE * Math.max(0.5, document.playbackRate || 1))),
  );
}

export function document_time_spent(document?: VoticDocument | null) {
  return Object.values(document?.activity || {}).reduce(
    (total, activity) => total + (activity.readingSeconds || 0),
    0,
  );
}

export function start_of_current_week(now = new Date()) {
  const start = new Date(now);
  const day = start.getDay();
  const distance = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - distance);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function period_insights(documents: VoticDocument[], start: Date, end: Date) {
  let readingSeconds = 0;
  let listeningSeconds = 0;
  const activeDays = new Set<string>();
  for (const document of documents) {
    for (const [day, activity] of Object.entries(document.activity || {})) {
      const time = new Date(day + "T00:00:00").getTime();
      if (time >= start.getTime() && time < end.getTime()) {
        readingSeconds += activity.readingSeconds || 0;
        listeningSeconds += activity.listeningSeconds || 0;
        if ((activity.readingSeconds || 0) > 0) activeDays.add(day);
      }
    }
  }
  const completedDocuments = documents.filter(
    (document) =>
      document.completedAt && document.completedAt >= start.getTime() && document.completedAt < end.getTime(),
  );
  const savedPassages = documents.flatMap((document) =>
    (document.savedPassages || [])
      .filter((passage) => passage.createdAt >= start.getTime() && passage.createdAt < end.getTime())
      .map((passage) => ({ document, passage })),
  );
  return {
    readingMinutes: Math.round(readingSeconds / 60),
    listeningMinutes: Math.round(listeningSeconds / 60),
    completed: completedDocuments.length,
    completedDocuments,
    saved: savedPassages.length,
    savedPassages,
    activeDays: activeDays.size,
  };
}

export function weekly_comparison(documents: VoticDocument[], now = new Date()) {
  const currentStart = start_of_current_week(now);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 7);
  const currentEnd = new Date(currentStart);
  currentEnd.setDate(currentEnd.getDate() + 7);
  const current = period_insights(documents, currentStart, currentEnd);
  const previous = period_insights(documents, previousStart, currentStart);
  const change = previous.readingMinutes
    ? Math.round(((current.readingMinutes - previous.readingMinutes) / previous.readingMinutes) * 100)
    : null;
  return { current, previous, change };
}

export function recent_week_activity(documents: VoticDocument[], count = 4, now = new Date()) {
  const currentStart = start_of_current_week(now);
  return Array.from({ length: count }, (_, offset) => {
    const start = new Date(currentStart);
    start.setDate(start.getDate() - (count - offset - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, ...period_insights(documents, start, end) };
  });
}

/**
 * The document to continue: the most recently opened one that's started but not finished. A document that was
 * only opened (still at its first passage) is offered only when nothing is in progress, so glancing at a new
 * file doesn't push the book you're reading off Home.
 */
export function most_recent_incomplete(documents: VoticDocument[]) {
  const recent = documents
    .filter((document) => document.progress < 1)
    .sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt));
  return recent.find((document) => document.progress > 0 || document.sentenceIndex > 0) ?? recent[0];
}
