import { describe, expect, it } from "vitest";
import {
  activeDaySet,
  addAskEvent,
  addInterval,
  askSummary,
  chartSeries,
  documentRanking,
  emptyLog,
  formatDuration,
  hasEarlierPeriod,
  insights,
  monthCalendar,
  parseLog,
  periodFor,
  spokenDuration,
  streaks,
  summarize,
} from "./activityModel";
import { categorizeQuestion } from "./askCategories";
import { READING_IDLE_MS, createSessionTracker } from "./sessionTracker";

const at = (text: string) => new Date(text).getTime();
const MIN = 60_000;

describe("addInterval", () => {
  it("splits a session that crosses midnight into the right local days", () => {
    const log = addInterval(
      emptyLog(0),
      "doc",
      "listening",
      at("2026-10-01T23:50:00"),
      at("2026-10-02T00:20:00"),
    );
    expect(log.buckets["2026-10-01T23"].doc.listening).toBe(10 * MIN);
    expect(log.buckets["2026-10-02T00"].doc.listening).toBe(20 * MIN);
    const days = summarize(log, new Date(2026, 9, 2), new Date(2026, 9, 3));
    expect(days.listening).toBe(20 * MIN);
  });

  it("ignores empty or backwards intervals", () => {
    const log = emptyLog(0);
    expect(addInterval(log, "doc", "reading", 10, 10)).toBe(log);
    expect(addInterval(log, "doc", "reading", 10, 5)).toBe(log);
  });
});

describe("session tracker", () => {
  function tracker() {
    let clock = at("2026-10-01T09:00:00");
    const recorded: { kind: string; ms: number }[] = [];
    const t = createSessionTracker(
      (_id, kind, start, end) => recorded.push({ kind, ms: end - start }),
      () => clock,
    );
    const advance = (ms: number) => {
      clock += ms;
    };
    const total = (kind: string) => recorded.filter((r) => r.kind === kind).reduce((s, r) => s + r.ms, 0);
    return { t, advance, total };
  }

  it("counts reading only while engaged, and stops after two idle minutes", () => {
    const { t, advance, total } = tracker();
    t.update({ documentId: "doc" });
    for (let i = 0; i < 60; i += 1) {
      advance(10_000);
      t.tick();
    }
    // Ten minutes open, but only two minutes after the last interaction count.
    expect(total("reading")).toBe(READING_IDLE_MS);
    t.engaged();
    advance(30_000);
    t.tick();
    expect(total("reading")).toBe(READING_IDLE_MS + 30_000);
  });

  it("counts listening by elapsed playback and never double counts reading", () => {
    const { t, advance, total } = tracker();
    t.update({ documentId: "doc" });
    advance(20_000);
    t.update({ playing: true });
    for (let i = 0; i < 30; i += 1) {
      advance(10_000);
      t.tick();
    }
    t.update({ playing: false });
    expect(total("listening")).toBe(5 * MIN);
    expect(total("reading")).toBe(20_000);
  });

  it("excludes time with the app in the background", () => {
    const { t, advance, total } = tracker();
    t.update({ documentId: "doc", playing: true });
    for (let i = 0; i < 6; i += 1) {
      advance(10_000);
      t.tick();
    }
    t.update({ appActive: false });
    advance(30 * MIN);
    t.update({ appActive: true });
    advance(10_000);
    t.tick();
    expect(total("listening")).toBe(70_000);
  });

  it("does not count a gap where timers stopped (the app was suspended without notice)", () => {
    const { t, advance, total } = tracker();
    t.update({ documentId: "doc", playing: true });
    advance(10_000);
    t.tick();
    advance(45 * MIN);
    t.tick();
    expect(total("listening")).toBe(10_000);
  });

  it("stops measuring when the Reader closes", () => {
    const { t, advance, total } = tracker();
    t.update({ documentId: "doc" });
    advance(30_000);
    t.stop();
    advance(5 * MIN);
    t.tick();
    expect(total("reading")).toBe(30_000);
  });
});

function sampleLog() {
  let log = emptyLog(at("2026-09-01T08:00:00"));
  const add = (day: string, hour: number, doc: string, readingMin: number, listeningMin: number) => {
    const start = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).getTime();
    if (readingMin) log = addInterval(log, doc, "reading", start, start + readingMin * MIN);
    if (listeningMin) log = addInterval(log, doc, "listening", start, start + listeningMin * MIN);
  };
  add("2026-09-28", 8, "a", 10, 20); // Monday, last week
  add("2026-09-29", 20, "b", 5, 0);
  add("2026-09-30", 20, "a", 15, 25);
  add("2026-10-01", 21, "a", 0, 30); // Thursday
  add("2026-10-02", 9, "b", 0.5, 0); // under a minute: not an active day
  return log;
}
const NOW = new Date(2026, 9, 2, 12);

describe("periods and totals", () => {
  it("labels weeks and months and moves back through them", () => {
    expect(periodFor("week", 0, NOW).label).toBe("This week");
    expect(periodFor("week", 1, NOW).label).toBe("Last week");
    expect(periodFor("week", 2, NOW).label).toBe("Sep 14 – Sep 20");
    expect(periodFor("month", 1, NOW).label).toBe("September");
    expect(periodFor("all", 0, NOW, at("2026-09-01T08:00:00")).label).toBe("Since Sep 1, 2026");
    expect(periodFor("week", 0, NOW).start).toEqual(new Date(2026, 8, 28));
  });

  it("only offers earlier periods after measurement began", () => {
    const started = at("2026-09-30T10:00:00");
    expect(hasEarlierPeriod(periodFor("week", 0, NOW), started)).toBe(false);
    expect(hasEarlierPeriod(periodFor("week", 0, NOW), at("2026-09-01T10:00:00"))).toBe(true);
  });

  it("summarizes reading, listening, and active days", () => {
    const week = periodFor("week", 0, NOW);
    expect(summarize(sampleLog(), week.start, week.end)).toEqual({
      reading: 30.5 * MIN,
      listening: 75 * MIN,
      total: 105.5 * MIN,
      activeDays: 4,
    });
  });

  it("builds a seven-day chart with an entry for every day", () => {
    const series = chartSeries(sampleLog(), periodFor("week", 0, NOW), NOW);
    expect(series.map((point) => point.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(series[3]).toMatchObject({ listening: 30 * MIN, longLabel: "Thursday, Oct 1" });
    expect(series[6]).toMatchObject({ reading: 0, listening: 0 });
  });

  it("uses monthly bars for all time", () => {
    const series = chartSeries(sampleLog(), periodFor("all", 0, NOW, at("2026-09-01T08:00:00")), NOW);
    expect(series.map((point) => point.longLabel)).toEqual(["September 2026", "October 2026"]);
  });
});

describe("activity and streaks", () => {
  it("counts streaks from meaningful days only", () => {
    const log = sampleLog();
    expect(activeDaySet(log).has("2026-10-02")).toBe(false);
    // Today (Oct 2) has under a minute, so the streak runs through yesterday.
    expect(streaks(log, NOW)).toMatchObject({ current: 4, longest: 4 });
    expect(streaks(log, new Date(2026, 9, 4)).current).toBe(0);
  });

  it("lays out a month calendar starting on Monday", () => {
    const calendar = monthCalendar(sampleLog(), new Date(2026, 9, 1));
    expect(calendar.label).toBe("October 2026");
    // October 1, 2026 is a Thursday.
    expect(calendar.weeks[0].slice(0, 4)).toEqual([
      null,
      null,
      null,
      { day: 1, key: "2026-10-01", active: true },
    ]);
  });
});

describe("documents and insights", () => {
  it("ranks documents by time in the period", () => {
    const week = periodFor("week", 0, NOW);
    expect(documentRanking(sampleLog(), week.start, week.end).map((entry) => entry.documentId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("waits for enough activity before showing insights", () => {
    let log = emptyLog(0);
    log = addInterval(log, "a", "reading", at("2026-10-01T09:00:00"), at("2026-10-01T09:20:00"));
    expect(insights(log, periodFor("week", 0, NOW), NOW).enough).toBe(false);
    const enough = insights(sampleLog(), periodFor("week", 0, NOW), NOW);
    expect(enough.enough).toBe(true);
    expect(enough.mostActiveTime?.label).toBe("Evening");
    // A week is too short to name a most active weekday.
    expect(enough.mostActiveWeekday).toBeNull();
    expect(Math.round(enough.listeningShare * 100)).toBe(71);
    // Last week has no activity, so there is no comparison.
    expect(enough.comparison).toBeNull();
  });
});

describe("Ask Votic", () => {
  it("counts questions and new conversations, and keeps only suggestion labels", () => {
    let log = emptyLog(0);
    const t = at("2026-10-01T10:00:00");
    log = addAskEvent(log, {
      at: t,
      category: "summary",
      prompt: "Summarize this document",
      newConversation: true,
    });
    log = addAskEvent(log, {
      at: t + 1,
      category: "summary",
      prompt: "Summarize this document",
      newConversation: true,
    });
    log = addAskEvent(log, { at: t + 2, category: "other", newConversation: false });
    const week = periodFor("week", 0, NOW);
    expect(askSummary(log, week.start, week.end)).toEqual({
      questions: 3,
      conversations: 2,
      categories: [
        { category: "summary", count: 2 },
        { category: "other", count: 1 },
      ],
      recurringPrompts: [{ prompt: "Summarize this document", count: 2 }],
    });
  });

  it("categorizes questions with simple local rules", () => {
    expect(categorizeQuestion("Summarize this document")).toBe("summary");
    expect(categorizeQuestion("What's the difference between mitosis and meiosis?")).toBe("comparison");
    expect(categorizeQuestion("What does entropy mean here?")).toBe("definition");
    expect(categorizeQuestion("What is ATP?")).toBe("definition");
    expect(categorizeQuestion("Why did the author choose this example?")).toBe("explanation");
    expect(categorizeQuestion("Find information about dates")).toBe("other");
  });
});

describe("storage and formatting", () => {
  it("drops damaged entries instead of failing", () => {
    const parsed = parseLog(
      JSON.stringify({
        version: 1,
        trackingStartedAt: 5,
        buckets: { bad: {}, "2026-10-01T09": { a: { reading: "x", listening: 60000 } } },
        ask: [{ at: 1, category: "summary" }, { nope: true }],
      }),
    );
    expect(parsed?.buckets).toEqual({ "2026-10-01T09": { a: { reading: 0, listening: 60000 } } });
    expect(parsed?.ask).toHaveLength(1);
    expect(parseLog("{not json")).toBeNull();
    expect(parseLog(JSON.stringify({ version: 2 }))).toBeNull();
  });

  it("formats durations for sight and for screen readers", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(20_000)).toBe("under 1 min");
    expect(formatDuration(125 * MIN)).toBe("2 h 5 min");
    expect(spokenDuration(61 * MIN)).toBe("1 hour 1 minute");
  });

  it("builds an empty log stamped with when tracking began", () => {
    expect(emptyLog(42)).toEqual({ version: 1, trackingStartedAt: 42, buckets: {}, ask: [] });
  });
});
