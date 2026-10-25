import { describe, expect, it } from "vitest";
import {
  active_day_set,
  add_ask_event,
  add_interval,
  ask_summary,
  chart_series,
  document_ranking,
  empty_log,
  format_duration,
  has_earlier_period,
  insights,
  month_calendar,
  parse_log,
  period_for,
  spoken_duration,
  shows_axis_label,
  streaks,
  summarize,
} from "./activityModel";
import { categorize_question } from "./askCategories";
import { READING_IDLE_MS, TICK_MS, create_session_tracker } from "./sessionTracker";

const at = (text: string) => new Date(text).getTime();
const MIN = 60_000;

describe("add_interval", () => {
  it("splits a session that crosses midnight into the right local days", () => {
    const log = add_interval(
      empty_log(0),
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
    const log = empty_log(0);
    expect(add_interval(log, "doc", "reading", 10, 10)).toBe(log);
    expect(add_interval(log, "doc", "reading", 10, 5)).toBe(log);
  });
});

describe("session tracker", () => {
  function tracker() {
    let clock = at("2026-10-01T09:00:00");
    const recorded: { kind: string; ms: number }[] = [];
    const t = create_session_tracker(
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

function sample_log() {
  let log = empty_log(at("2026-09-01T08:00:00"));
  const add = (day: string, hour: number, doc: string, readingMin: number, listeningMin: number) => {
    const start = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).getTime();
    if (readingMin) log = add_interval(log, doc, "reading", start, start + readingMin * MIN);
    if (listeningMin) log = add_interval(log, doc, "listening", start, start + listeningMin * MIN);
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
    expect(period_for("week", 0, NOW).label).toBe("This week");
    expect(period_for("week", 1, NOW).label).toBe("Last week");
    expect(period_for("week", 2, NOW).label).toBe("Sep 14 – Sep 20");
    expect(period_for("month", 1, NOW).label).toBe("September");
    expect(period_for("all", 0, NOW, at("2026-09-01T08:00:00")).label).toBe("Since Sep 1, 2026");
    expect(period_for("week", 0, NOW).start).toEqual(new Date(2026, 8, 28));
  });

  it("only offers earlier periods after measurement began", () => {
    const started = at("2026-09-30T10:00:00");
    expect(has_earlier_period(period_for("week", 0, NOW), started)).toBe(false);
    expect(has_earlier_period(period_for("week", 0, NOW), at("2026-09-01T10:00:00"))).toBe(true);
  });

  it("summarizes reading, listening, and active days", () => {
    const week = period_for("week", 0, NOW);
    expect(summarize(sample_log(), week.start, week.end)).toEqual({
      reading: 30.5 * MIN,
      listening: 75 * MIN,
      total: 105.5 * MIN,
      activeDays: 4,
    });
  });

  it("builds a seven-day chart with an entry for every day", () => {
    const series = chart_series(sample_log(), period_for("week", 0, NOW), NOW);
    expect(series.map((point) => point.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(series[3]).toMatchObject({ listening: 30 * MIN, longLabel: "Thursday, Oct 1" });
    expect(series[6]).toMatchObject({ reading: 0, listening: 0 });
  });

  it.each([
    ["February (28 days)", new Date(2026, 1, 10), 28],
    ["leap-year February (29 days)", new Date(2028, 1, 10), 29],
    ["September (30 days)", new Date(2026, 8, 10), 30],
    ["October (31 days)", new Date(2026, 9, 10), 31],
  ])("labels one day a week in %s without changing the bars", (_name, now, days) => {
    const series = chart_series(empty_log(), period_for("month", 0, now), now);
    expect(series).toHaveLength(days);
    const shown = series.filter((_point, index) => shows_axis_label(index, series.length));
    expect(shown.map((point) => point.label)).toEqual(
      ["1", "8", "15", "22", "29"].filter((day) => Number(day) <= days),
    );
    // Neighbouring labels are always a week of bars apart, so they never crowd each other.
    expect(series.every((point) => point.longLabel.length > 0)).toBe(true);
  });

  it("labels every bar for a week and for up to twelve months", () => {
    for (const count of [7, 2, 12]) {
      for (let index = 0; index < count; index += 1) expect(shows_axis_label(index, count)).toBe(true);
    }
  });

  it("uses monthly bars for all time", () => {
    const series = chart_series(sample_log(), period_for("all", 0, NOW, at("2026-09-01T08:00:00")), NOW);
    expect(series.map((point) => point.longLabel)).toEqual(["September 2026", "October 2026"]);
  });
});

describe("activity and streaks", () => {
  it("counts streaks from meaningful days only", () => {
    const log = sample_log();
    expect(active_day_set(log).has("2026-10-02")).toBe(false);
    // Today (Oct 2) has under a minute, so the streak runs through yesterday.
    expect(streaks(log, NOW)).toMatchObject({ current: 4, longest: 4 });
    expect(streaks(log, new Date(2026, 9, 4)).current).toBe(0);
  });

  it("lays out a month calendar starting on Monday", () => {
    const calendar = month_calendar(sample_log(), new Date(2026, 9, 1));
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
    const week = period_for("week", 0, NOW);
    expect(document_ranking(sample_log(), week.start, week.end).map((entry) => entry.documentId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("waits for enough activity before showing insights", () => {
    let log = empty_log(0);
    log = add_interval(log, "a", "reading", at("2026-10-01T09:00:00"), at("2026-10-01T09:20:00"));
    expect(insights(log, period_for("week", 0, NOW), NOW).enough).toBe(false);
    const enough = insights(sample_log(), period_for("week", 0, NOW), NOW);
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
    let log = empty_log(0);
    const t = at("2026-10-01T10:00:00");
    log = add_ask_event(log, {
      at: t,
      category: "summary",
      prompt: "Summarize this document",
      newConversation: true,
    });
    log = add_ask_event(log, {
      at: t + 1,
      category: "summary",
      prompt: "Summarize this document",
      newConversation: true,
    });
    log = add_ask_event(log, { at: t + 2, category: "other", newConversation: false });
    const week = period_for("week", 0, NOW);
    expect(ask_summary(log, week.start, week.end)).toEqual({
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
    expect(categorize_question("Summarize this document")).toBe("summary");
    expect(categorize_question("What's the difference between mitosis and meiosis?")).toBe("comparison");
    expect(categorize_question("What does entropy mean here?")).toBe("definition");
    expect(categorize_question("What is ATP?")).toBe("definition");
    expect(categorize_question("Why did the author choose this example?")).toBe("explanation");
    expect(categorize_question("Find information about dates")).toBe("other");
  });
});

describe("storage and formatting", () => {
  it("drops damaged entries instead of failing", () => {
    const parsed = parse_log(
      JSON.stringify({
        version: 1,
        trackingStartedAt: 5,
        buckets: { bad: {}, "2026-10-01T09": { a: { reading: "x", listening: 60000 } } },
        ask: [{ at: 1, category: "summary" }, { nope: true }],
      }),
    );
    expect(parsed?.buckets).toEqual({ "2026-10-01T09": { a: { reading: 0, listening: 60000 } } });
    expect(parsed?.ask).toHaveLength(1);
    expect(parse_log("{not json")).toBeNull();
    expect(parse_log(JSON.stringify({ version: 2 }))).toBeNull();
  });

  it("formats durations for sight and for screen readers", () => {
    expect(format_duration(0)).toBe("0 min");
    expect(format_duration(20_000)).toBe("under 1 min");
    expect(format_duration(125 * MIN)).toBe("2 h 5 min");
    expect(spoken_duration(61 * MIN)).toBe("1 hour 1 minute");
  });

  it("builds an empty log stamped with when tracking began", () => {
    expect(empty_log(42)).toEqual({ version: 1, trackingStartedAt: 42, buckets: {}, ask: [] });
  });
});

describe("reading statistics count real time, not visits", () => {
  const MIN_MS = 60_000;
  function measure(
    steps: (tracker: ReturnType<typeof create_session_tracker>, advance: (ms: number) => void) => void,
  ) {
    let clock = 1_000_000;
    const intervals: { kind: string; ms: number }[] = [];
    const tracker = create_session_tracker(
      (_id, kind, start, end) => intervals.push({ kind, ms: end - start }),
      () => clock,
    );
    const advance = (ms: number) => {
      // The Reader checks in every 10 seconds while open.
      for (let left = ms; left > 0; left -= TICK_MS) {
        clock += Math.min(TICK_MS, left);
        tracker.tick();
      }
    };
    steps(tracker, advance);
    tracker.stop();
    const total = (kind: string) =>
      intervals.filter((i) => i.kind === kind).reduce((sum, i) => sum + i.ms, 0);
    return { reading: total("reading"), listening: total("listening") };
  }
  const open_doc = (tracker: ReturnType<typeof create_session_tracker>) =>
    tracker.update({ documentId: "doc", appActive: true, playing: false });

  it("opening and immediately closing a document adds no minute", () => {
    const { reading } = measure((tracker) => {
      open_doc(tracker);
      tracker.stop();
    });
    expect(reading).toBe(0);
    expect(format_duration(24 * MIN_MS + reading)).toBe("24 min");
  });
  it("records the real elapsed time for 10, 30, 60 seconds and 5 minutes, showing only completed minutes", () => {
    for (const [seconds, shown] of [
      [10, "under 1 min"],
      [30, "under 1 min"],
      [60, "1 min"],
      [300, "5 min"],
    ] as const) {
      const { reading } = measure((tracker, advance) => {
        open_doc(tracker);
        for (let at = 0; at < seconds * 1000; at += 20_000) {
          advance(Math.min(20_000, seconds * 1000 - at));
          tracker.engaged();
        }
      });
      expect(reading).toBe(seconds * 1000);
      expect(format_duration(reading)).toBe(shown);
    }
  });
  it("a total just past a half minute does not round up after a brief visit", () => {
    // 24 min 25 s, then a 10-second visit: 24 min 35 s is still 24 completed minutes.
    const { reading } = measure((tracker, advance) => {
      open_doc(tracker);
      advance(10_000);
    });
    expect(format_duration(24 * MIN_MS + 25_000 + reading)).toBe("24 min");
  });
  it("opening and closing ten times rapidly counts only the seconds actually open", () => {
    const { reading } = measure((tracker, advance) => {
      for (let visit = 0; visit < 10; visit++) {
        open_doc(tracker);
        advance(500);
        tracker.stop();
        advance(500);
      }
    });
    expect(reading).toBe(5_000);
    expect(format_duration(reading)).toBe("under 1 min");
  });
  it("stops counting in the background and after two idle minutes", () => {
    const { reading } = measure((tracker, advance) => {
      open_doc(tracker);
      advance(30_000);
      tracker.update({ appActive: false });
      advance(10 * MIN_MS);
      tracker.update({ appActive: true });
      tracker.engaged();
      // No interaction for ten minutes: only the first two count.
      advance(10 * MIN_MS);
    });
    expect(reading).toBe(30_000 + READING_IDLE_MS);
  });
  it("counts listening only while narration plays, and never as reading at the same time", () => {
    const { reading, listening } = measure((tracker, advance) => {
      open_doc(tracker);
      tracker.update({ playing: true });
      advance(90_000);
      tracker.update({ playing: false });
      advance(0);
    });
    expect(listening).toBe(90_000);
    expect(reading).toBe(0);
  });
});
