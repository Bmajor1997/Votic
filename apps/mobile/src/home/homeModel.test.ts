import { describe, expect, it } from "vitest";
import { add_interval, empty_log } from "../activity/activityModel";
import { VoticDocument } from "../documents/types";
import {
  change_label,
  home_insight,
  home_notes,
  last_session,
  relative_day,
  resume_mode_for,
  week_activity,
} from "./homeModel";

const MIN = 60_000;
// Thursday, October 1, 2026, at noon local time.
const now = new Date(2026, 9, 1, 12);
/** September dates from 2 to 30, and October 1. */
const at = (day: number, hour: number) => new Date(2026, day === 1 ? 9 : 8, day, hour).getTime();
const doc = (id: string, extra: Partial<VoticDocument> = {}): VoticDocument => ({
  id,
  title: id,
  sourceName: `${id}.pdf`,
  plainText: Array.from({ length: 2000 }, () => "word").join(" "),
  importedAt: 1,
  updatedAt: 1,
  progress: 0.5,
  sentenceIndex: 0,
  wordIndex: 0,
  playbackRate: 1,
  ...extra,
});

describe("resuming a document", () => {
  it("resumes the way the document was last used", () => {
    let log = add_interval(empty_log(0), "a", "reading", at(28, 9), at(28, 9) + 20 * MIN);
    log = add_interval(log, "a", "listening", at(30, 18), at(30, 18) + 5 * MIN);
    expect(resume_mode_for(log, "a", now)).toBe("listen");
    expect(last_session(log, "a")).toEqual({ mode: "listen", at: at(30, 18) });
    log = add_interval(log, "a", "reading", at(1, 8), at(1, 8) + 2 * MIN);
    expect(resume_mode_for(log, "a", now)).toBe("read");
  });

  it("falls back to how Votic is used lately, then to reading", () => {
    expect(resume_mode_for(empty_log(0), "new", now)).toBe("read");
    const listener = add_interval(empty_log(0), "other", "listening", at(29, 9), at(29, 9) + 30 * MIN);
    expect(resume_mode_for(listener, "new", now)).toBe("listen");
  });
});

describe("this week", () => {
  it("totals reading and listening by day, Monday to Sunday", () => {
    let log = add_interval(empty_log(0), "a", "reading", at(28, 9), at(28, 9) + 20 * MIN);
    log = add_interval(log, "a", "listening", at(1, 9), at(1, 9) + 10 * MIN);
    const week = week_activity(log, now);
    expect(week.total).toBe(30 * MIN);
    expect(week.reading).toBe(20 * MIN);
    expect(week.days.map((day) => day.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(week.days.map((day) => day.total / MIN)).toEqual([20, 0, 0, 10, 0, 0, 0]);
    expect(week.days.findIndex((day) => day.isToday)).toBe(3);
    // No activity last week, so no percentage.
    expect(week.change).toBeNull();
  });

  it("compares with last week only when both weeks have real activity", () => {
    let log = add_interval(empty_log(0), "a", "reading", at(22, 9), at(22, 9) + 20 * MIN);
    log = add_interval(log, "a", "reading", at(29, 9), at(29, 9) + 30 * MIN);
    expect(week_activity(log, now).change).toBeCloseTo(0.5);
    expect(change_label(0.5)).toBe("Up 50% from last week");
    expect(change_label(-0.054)).toBe("Down 5% from last week");
    expect(change_label(0.001)).toBe("Same as last week");
  });
});

describe("personal insight", () => {
  it("stays quiet without enough activity", () => {
    const light = add_interval(empty_log(0), "a", "listening", at(1, 9), at(1, 9) + 40 * MIN);
    expect(home_insight(light, [], now)).toBeNull();
  });

  it("states facts from measured time and finished documents", () => {
    let log = empty_log(0);
    for (const day of [28, 29, 30])
      log = add_interval(log, "a", "listening", at(day, 19), at(day, 19) + 20 * MIN);
    expect(home_insight(log, [], now)).toBe("Most of your time with Votic this week was listening.");
    const finished = [doc("x", { completedAt: at(1, 8) }), doc("y", { completedAt: at(1, 9) })];
    expect(home_insight(log, finished, now)).toBe("You've finished 2 documents this month.");
  });
});

describe("notes on Home", () => {
  it("puts pinned notes first, then the most recent", () => {
    const passage = (id: string, updatedAt: number, pinned = false) => ({
      id,
      sentenceIndex: 0,
      text: id,
      note: "",
      createdAt: updatedAt,
      updatedAt,
      pinned,
    });
    const documents = [
      doc("a", { savedPassages: [passage("old-pinned", 1, true), passage("newest", 9)] }),
      doc("b", { savedPassages: [passage("middle", 5)] }),
    ];
    expect(home_notes(documents).map((item) => item.passage.id)).toEqual(["old-pinned", "newest", "middle"]);
    expect(home_notes(documents, 1)).toHaveLength(1);
  });

  it("names recent days plainly", () => {
    expect(relative_day(at(1, 8), now)).toBe("Today");
    expect(relative_day(at(30, 23), now)).toBe("Yesterday");
    expect(relative_day(at(27, 8), now)).toBe("4 days ago");
  });
});

describe("week boundaries", () => {
  it("counts only the part of a session after Monday midnight, the same way Statistics does", async () => {
    const { period_for, summarize } = await import("../activity/activityModel");
    // The week of Thursday, October 1 starts Monday, September 28. A session runs 23:55 Sunday to 00:05 Monday.
    const monday = new Date(2026, 8, 28).getTime();
    const log = add_interval(empty_log(0), "a", "reading", monday - 5 * MIN, monday + 5 * MIN);
    const week = period_for("week", 0, now);
    expect(week.start.getTime()).toBe(monday);
    expect(week_activity(log, now).total).toBe(summarize(log, week.start, week.end).total);
    expect(week_activity(log, now).total).toBe(5 * MIN);
  });
});
