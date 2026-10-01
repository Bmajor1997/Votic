/**
 * Votic's activity measurements and the statistics built from them.
 *
 * Time is stored as milliseconds per local hour, per document, split into reading and listening:
 * buckets["2026-10-01T09"]["doc-1"] = { reading: 120000, listening: 30000 }.
 * Hourly buckets in the device's local time give day totals, streaks, day-of-week and
 * time-of-day insights without keeping a raw event log. Ask Votic keeps one small event per
 * question with only its category, never its text.
 */
import { AskCategory } from "./askCategories";

export type ActivityKind = "reading" | "listening";
export type TimeSplit = { reading: number; listening: number };
export type AskEvent = {
  at: number;
  category: AskCategory;
  /** The label of a built-in suggestion when one was used. Typed questions are never stored. */
  prompt?: string;
  /** The first question since Ask Votic was opened with an empty conversation. */
  newConversation: boolean;
};
export type ActivityLog = {
  version: 1;
  /** When measurement began on this device. Earlier activity is not reconstructed. */
  trackingStartedAt: number;
  buckets: Record<string, Record<string, TimeSplit>>;
  ask: AskEvent[];
};

/** A day counts as active after one minute of reading or listening, so opening the app does not count. */
export const ACTIVE_DAY_MS = 60_000;
const MAX_ASK_EVENTS = 5000;

export function emptyLog(now = Date.now()): ActivityLog {
  return { version: 1, trackingStartedAt: now, buckets: {}, ask: [] };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function hourKey(date: Date) {
  return `${dayKey(date)}T${pad(date.getHours())}`;
}
export function dateFromDayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Adds time to the log, split at each local hour (and so at midnight). Returns a new log. */
export function addInterval(
  log: ActivityLog,
  documentId: string,
  kind: ActivityKind,
  start: number,
  end: number,
): ActivityLog {
  if (!(end > start) || !documentId) return log;
  const buckets = { ...log.buckets };
  let cursor = start;
  while (cursor < end) {
    const at = new Date(cursor);
    const nextHour = new Date(at);
    nextHour.setMinutes(60, 0, 0);
    const chunkEnd = Math.min(end, nextHour.getTime());
    const key = hourKey(at);
    const hour = { ...buckets[key] };
    const current = hour[documentId] ?? { reading: 0, listening: 0 };
    hour[documentId] = { ...current, [kind]: current[kind] + (chunkEnd - cursor) };
    buckets[key] = hour;
    cursor = chunkEnd;
  }
  return { ...log, buckets };
}

export function addAskEvent(log: ActivityLog, event: AskEvent): ActivityLog {
  return { ...log, ask: [...log.ask, event].slice(-MAX_ASK_EVENTS) };
}

/** Accepts only well-formed saved data, so a damaged entry cannot break Statistics. */
export function parseLog(raw: string | null): ActivityLog | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || typeof value.trackingStartedAt !== "number") return null;
    const buckets: ActivityLog["buckets"] = {};
    for (const [key, hour] of Object.entries(value.buckets ?? {})) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(key) || !hour || typeof hour !== "object") continue;
      const clean: Record<string, TimeSplit> = {};
      for (const [documentId, split] of Object.entries(hour as Record<string, Partial<TimeSplit>>)) {
        const reading = Number(split?.reading) || 0;
        const listening = Number(split?.listening) || 0;
        if (reading > 0 || listening > 0)
          clean[documentId] = { reading: Math.max(0, reading), listening: Math.max(0, listening) };
      }
      buckets[key] = clean;
    }
    const ask = Array.isArray(value.ask)
      ? value.ask.filter(
          (event: Partial<AskEvent>) => typeof event?.at === "number" && typeof event.category === "string",
        )
      : [];
    return { version: 1, trackingStartedAt: value.trackingStartedAt, buckets, ask };
  } catch {
    return null;
  }
}

// ---------- Periods ----------

export type PeriodKind = "week" | "month" | "all";
export type Period = { kind: PeriodKind; start: Date; end: Date; label: string; offset: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
function shortDate(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** The week (Monday to Sunday) or month `offset` periods before the current one, or all time. */
export function periodFor(
  kind: PeriodKind,
  offset = 0,
  now = new Date(),
  trackingStartedAt = now.getTime(),
): Period {
  if (kind === "week") {
    const start = addDays(startOfWeek(now), -7 * offset);
    const end = addDays(start, 7);
    const last = addDays(end, -1);
    const label =
      offset === 0
        ? "This week"
        : offset === 1
          ? "Last week"
          : `${shortDate(start)} – ${shortDate(last)}${last.getFullYear() !== now.getFullYear() ? `, ${last.getFullYear()}` : ""}`;
    return { kind, start, end, label, offset };
  }
  if (kind === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const label =
      offset === 0
        ? "This month"
        : `${LONG_MONTHS[start.getMonth()]}${start.getFullYear() !== now.getFullYear() ? ` ${start.getFullYear()}` : ""}`;
    return { kind, start, end, label, offset };
  }
  const tracking = new Date(trackingStartedAt);
  const start = new Date(tracking.getFullYear(), tracking.getMonth(), tracking.getDate());
  return {
    kind,
    start,
    end: addDays(now, 1),
    label: `Since ${shortDate(start)}, ${start.getFullYear()}`,
    offset: 0,
  };
}

/** The period of the same length just before this one, for comparisons. All time has none. */
export function previousPeriod(period: Period, now = new Date()): Period | null {
  return period.kind === "all" ? null : periodFor(period.kind, period.offset + 1, now);
}

/** Earlier periods exist only once measurement started before this one began. */
export function hasEarlierPeriod(period: Period, trackingStartedAt: number) {
  return period.kind !== "all" && period.start.getTime() > trackingStartedAt;
}

// ---------- Totals ----------

function bucketDate(key: string) {
  return new Date(dateFromDayKey(key.slice(0, 10)).getTime() + Number(key.slice(11)) * 3_600_000);
}
function inRange(key: string, start: Date, end: Date) {
  const day = dateFromDayKey(key.slice(0, 10));
  return day >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) && day < end;
}

/** Reading and listening per local day, across all documents. */
export function dailyTotals(log: ActivityLog) {
  const days = new Map<string, TimeSplit>();
  for (const [key, hour] of Object.entries(log.buckets)) {
    const day = key.slice(0, 10);
    const total = days.get(day) ?? { reading: 0, listening: 0 };
    for (const split of Object.values(hour)) {
      total.reading += split.reading;
      total.listening += split.listening;
    }
    days.set(day, total);
  }
  return days;
}

export type PeriodSummary = TimeSplit & { total: number; activeDays: number };
export function summarize(log: ActivityLog, start: Date, end: Date): PeriodSummary {
  let reading = 0;
  let listening = 0;
  let activeDays = 0;
  for (const [day, split] of dailyTotals(log)) {
    const date = dateFromDayKey(day);
    if (date < start || date >= end) continue;
    reading += split.reading;
    listening += split.listening;
    if (split.reading + split.listening >= ACTIVE_DAY_MS) activeDays += 1;
  }
  return { reading, listening, total: reading + listening, activeDays };
}

export type ChartPoint = TimeSplit & { key: string; label: string; longLabel: string };
/** Daily bars for a week or month; monthly bars (up to 12) for all time. */
export function chartSeries(log: ActivityLog, period: Period, now = new Date()): ChartPoint[] {
  const days = dailyTotals(log);
  if (period.kind !== "all") {
    const points: ChartPoint[] = [];
    for (let day = new Date(period.start); day < period.end; day = addDays(day, 1)) {
      const key = dayKey(day);
      const split = days.get(key) ?? { reading: 0, listening: 0 };
      points.push({
        ...split,
        key,
        label: period.kind === "week" ? WEEKDAYS[(day.getDay() + 6) % 7].slice(0, 1) : String(day.getDate()),
        longLabel: `${WEEKDAYS[(day.getDay() + 6) % 7]}, ${shortDate(day)}`,
      });
    }
    return points;
  }
  const first = new Date(
    Math.max(period.start.getTime(), new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime()),
  );
  const points: ChartPoint[] = [];
  for (
    let month = new Date(first.getFullYear(), first.getMonth(), 1);
    month <= now;
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  ) {
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const split = summarize(log, month, end);
    points.push({
      reading: split.reading,
      listening: split.listening,
      key: `${month.getFullYear()}-${pad(month.getMonth() + 1)}`,
      label: MONTHS[month.getMonth()].slice(0, 1),
      longLabel: `${LONG_MONTHS[month.getMonth()]} ${month.getFullYear()}`,
    });
  }
  return points;
}

// ---------- Activity ----------

export function activeDaySet(log: ActivityLog) {
  const active = new Set<string>();
  for (const [day, split] of dailyTotals(log))
    if (split.reading + split.listening >= ACTIVE_DAY_MS) active.add(day);
  return active;
}

/**
 * The current streak counts consecutive active days ending today, or ending yesterday when today
 * has no activity yet (so a streak is not "lost" first thing in the morning).
 */
export function streaks(log: ActivityLog, now = new Date()) {
  const active = activeDaySet(log);
  let current = 0;
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!active.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  while (active.has(dayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of [...active].sort()) {
    const date = dateFromDayKey(key);
    run = previous && dayKey(addDays(previous, 1)) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  return { current, longest, activeTodayOrYesterday: current > 0 };
}

/** One month as calendar weeks (Monday first); null pads the days outside the month. */
export function monthCalendar(log: ActivityLog, month: Date) {
  const active = activeDaySet(log);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const cells: ({ day: number; key: string; active: boolean } | null)[] = Array.from(
    { length: (first.getDay() + 6) % 7 },
    () => null,
  );
  for (let date = first; date.getMonth() === first.getMonth(); date = addDays(date, 1))
    cells.push({ day: date.getDate(), key: dayKey(date), active: active.has(dayKey(date)) });
  while (cells.length % 7) cells.push(null);
  return {
    label: `${LONG_MONTHS[first.getMonth()]} ${first.getFullYear()}`,
    weeks: Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7)),
  };
}

// ---------- Documents ----------

export type DocumentTime = TimeSplit & { documentId: string; total: number; lastActiveAt: number };
/** Documents ranked by time spent reading or listening in the period. */
export function documentRanking(log: ActivityLog, start: Date, end: Date): DocumentTime[] {
  const byDocument = new Map<string, DocumentTime>();
  for (const [key, hour] of Object.entries(log.buckets)) {
    if (!inRange(key, start, end)) continue;
    const at = bucketDate(key).getTime();
    for (const [documentId, split] of Object.entries(hour)) {
      const entry = byDocument.get(documentId) ?? {
        documentId,
        reading: 0,
        listening: 0,
        total: 0,
        lastActiveAt: 0,
      };
      entry.reading += split.reading;
      entry.listening += split.listening;
      entry.total += split.reading + split.listening;
      entry.lastActiveAt = Math.max(entry.lastActiveAt, at);
      byDocument.set(documentId, entry);
    }
  }
  return [...byDocument.values()].filter((entry) => entry.total > 0).sort((a, b) => b.total - a.total);
}

// ---------- Ask Votic ----------

export function askSummary(log: ActivityLog, start: Date, end: Date) {
  const events = log.ask.filter((event) => event.at >= start.getTime() && event.at < end.getTime());
  const categories = new Map<AskCategory, number>();
  const prompts = new Map<string, number>();
  for (const event of events) {
    categories.set(event.category, (categories.get(event.category) ?? 0) + 1);
    if (event.prompt) prompts.set(event.prompt, (prompts.get(event.prompt) ?? 0) + 1);
  }
  return {
    questions: events.length,
    conversations: events.filter((event) => event.newConversation).length,
    categories: [...categories.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    /** Built-in suggestions used at least twice, most used first. */
    recurringPrompts: [...prompts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([prompt, count]) => ({ prompt, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
  };
}

// ---------- Personal insights ----------

/** Insights wait for at least this much time and this many active days in the period. */
export const INSIGHT_MIN_MS = 30 * 60_000;
export const INSIGHT_MIN_DAYS = 3;
export const TIME_OF_DAY = [
  { id: "morning", label: "Morning", range: "5 am – noon", from: 5, to: 12 },
  { id: "afternoon", label: "Afternoon", range: "noon – 5 pm", from: 12, to: 17 },
  { id: "evening", label: "Evening", range: "5 – 10 pm", from: 17, to: 22 },
  { id: "night", label: "Night", range: "10 pm – 5 am", from: 22, to: 29 },
] as const;

export function insights(log: ActivityLog, period: Period, now = new Date()) {
  const summary = summarize(log, period.start, period.end);
  const enough = summary.total >= INSIGHT_MIN_MS && summary.activeDays >= INSIGHT_MIN_DAYS;
  const weekday = Array.from({ length: 7 }, () => 0);
  const timeOfDay = new Map<string, number>(TIME_OF_DAY.map((slot) => [slot.id, 0]));
  for (const [key, hour] of Object.entries(log.buckets)) {
    if (!inRange(key, period.start, period.end)) continue;
    const total = Object.values(hour).reduce((sum, split) => sum + split.reading + split.listening, 0);
    const date = bucketDate(key);
    weekday[(date.getDay() + 6) % 7] += total;
    const hourOfDay = date.getHours() < 5 ? date.getHours() + 24 : date.getHours();
    const slot = TIME_OF_DAY.find((candidate) => hourOfDay >= candidate.from && hourOfDay < candidate.to);
    if (slot) timeOfDay.set(slot.id, (timeOfDay.get(slot.id) ?? 0) + total);
  }
  const topWeekday = weekday.indexOf(Math.max(...weekday));
  const topSlotId = [...timeOfDay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const previous = previousPeriod(period, now);
  const previousSummary = previous ? summarize(log, previous.start, previous.end) : null;
  // A comparison needs real activity on both sides, or a percentage would mislead.
  const comparable = previousSummary && previousSummary.total >= 10 * 60_000 && summary.total >= 10 * 60_000;
  return {
    enough,
    summary,
    listeningShare: summary.total ? summary.listening / summary.total : 0,
    // Most active weekday needs activity on several different days to mean anything.
    mostActiveWeekday: enough && period.kind !== "week" ? WEEKDAYS[topWeekday] : null,
    mostActiveTime: enough ? (TIME_OF_DAY.find((slot) => slot.id === topSlotId) ?? null) : null,
    comparison: comparable
      ? {
          previousLabel: previous!.label.toLowerCase(),
          change: (summary.total - previousSummary!.total) / previousSummary!.total,
        }
      : null,
  };
}

// ---------- Formatting ----------

/** "2 h 5 min", "45 min", "under 1 min", or "0 min". */
export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (ms > 0 && minutes === 0) return "under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** The same duration for screen readers, with words instead of abbreviations. */
export function spokenDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (ms > 0 && minutes === 0) return "less than a minute";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (rest || !hours) parts.push(`${rest} ${rest === 1 ? "minute" : "minutes"}`);
  return parts.join(" ");
}
