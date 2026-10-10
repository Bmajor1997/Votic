/**
 * What Votic's iPhone and Android home-screen widgets show, decided from data the app already keeps: the
 * library (documents and progress) and the activity log (reading and listening time).
 *
 * The widgets can't run app code, so the app hands them this small snapshot. It holds only what a widget
 * draws: titles, progress, and recent daily totals. Never document text or notes. Day totals are sent
 * rather than a finished weekly total so the widget stays right after midnight or a new week starts,
 * even if Votic hasn't been opened since.
 */
import { ActivityLog, dailyTotals, dayKey } from "../activity/activityModel";
import { fileTypeLabel, readableTitle } from "../documents/documentDisplay";
import { estimatedMinutesRemaining } from "../documents/insights";
import { VoticDocument } from "../documents/types";
import { resumeModeFor, ResumeMode } from "../home/homeModel";
import { documentWidgetTone, WidgetTone } from "../home/widgetDesign";

export const WIDGET_SNAPSHOT_VERSION = 1;
/** How many documents the larger widgets list under the one to continue. */
export const UP_NEXT_LIMIT = 3;
/** Enough days for this week, last week, and a streak that runs into last month. */
export const WIDGET_DAYS = 42;
const TITLE_LIMIT = 120;

export type WidgetDocument = {
  id: string;
  title: string;
  /** "PDF", "Word", "PowerPoint", "EPUB", "Markdown", or "Text". */
  kind: string;
  /** The same color family the document has on Home. */
  tone: WidgetTone;
  /** 0 to 1, rounded to whole percents. */
  progress: number;
  /** "42% · about 10 min left", "Not started", or "Finished". */
  status: string;
  /** How it was last used, so a tap resumes the same way. */
  mode: ResumeMode;
};

export type WidgetDay = {
  /** Local calendar day, "2026-10-09". */
  date: string;
  readingSeconds: number;
  listeningSeconds: number;
};

export type WidgetSnapshot = {
  version: typeof WIDGET_SNAPSHOT_VERSION;
  /** Signed out: the widgets show nothing from the library and ask to open Votic. */
  signedIn: boolean;
  /** The document in progress that was opened most recently. */
  continue: WidgetDocument | null;
  /** Other recent documents, unfinished first. */
  upNext: WidgetDocument[];
  /** How many documents are in the library, so an empty library can say so. */
  documentCount: number;
  /** Daily reading and listening for the last few weeks; days without activity are left out. */
  days: WidgetDay[];
};

export function signedOutSnapshot(): WidgetSnapshot {
  return {
    version: WIDGET_SNAPSHOT_VERSION,
    signedIn: false,
    continue: null,
    upNext: [],
    documentCount: 0,
    days: [],
  };
}

function shortTitle(document: VoticDocument) {
  const title = readableTitle(document.title);
  return title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT - 1).trimEnd()}…` : title;
}

function statusFor(document: VoticDocument) {
  if (document.progress >= 1) return "Finished";
  if (!document.progress) return "Not started";
  return `${Math.round(document.progress * 100)}% · about ${estimatedMinutesRemaining(document)} min left`;
}

export function widgetDocument(document: VoticDocument, log: ActivityLog, now = new Date()): WidgetDocument {
  return {
    id: document.id,
    title: shortTitle(document),
    kind: fileTypeLabel(document.sourceName),
    tone: documentWidgetTone(document.sourceName),
    progress: Math.round(Math.min(1, Math.max(0, document.progress || 0)) * 100) / 100,
    status: statusFor(document),
    mode: resumeModeFor(log, document.id, now),
  };
}

const lastUsed = (document: VoticDocument) => document.lastOpenedAt || document.updatedAt;

/** Reading and listening per day, newest first, within the last WIDGET_DAYS days. */
export function widgetDays(log: ActivityLog, now = new Date()): WidgetDay[] {
  const earliest = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WIDGET_DAYS - 1)));
  const today = dayKey(now);
  return [...dailyTotals(log)]
    .filter(([date, split]) => date >= earliest && date <= today && split.reading + split.listening > 0)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, split]) => ({
      date,
      readingSeconds: Math.round(split.reading / 1000),
      listeningSeconds: Math.round(split.listening / 1000),
    }));
}

export function buildWidgetSnapshot({
  documents,
  log,
  signedIn,
  now = new Date(),
}: {
  documents: VoticDocument[];
  log: ActivityLog;
  signedIn: boolean;
  now?: Date;
}): WidgetSnapshot {
  if (!signedIn) return signedOutSnapshot();
  // Quick Notes is a notebook, not something to read or listen to.
  const library = documents.filter((document) => !document.notebookKind);
  const byRecent = [...library].sort((a, b) => lastUsed(b) - lastUsed(a));
  const current = byRecent.find((document) => document.progress < 1) ?? null;
  const others = byRecent.filter((document) => document.id !== current?.id);
  const upNext = [
    ...others.filter((document) => document.progress < 1),
    ...others.filter((document) => document.progress >= 1),
  ].slice(0, UP_NEXT_LIMIT);
  return {
    version: WIDGET_SNAPSHOT_VERSION,
    signedIn: true,
    continue: current ? widgetDocument(current, log, now) : null,
    upNext: upNext.map((document) => widgetDocument(document, log, now)),
    documentCount: library.length,
    days: widgetDays(log, now),
  };
}
