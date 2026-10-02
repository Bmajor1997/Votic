import { describe, expect, it } from "vitest";
import { addInterval, emptyLog } from "../activity/activityModel";
import { VoticDocument } from "../documents/types";
import {
  changeLabel,
  homeInsight,
  homeNotes,
  lastSession,
  relativeDay,
  resumeModeFor,
  weekActivity,
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
    let log = addInterval(emptyLog(0), "a", "reading", at(28, 9), at(28, 9) + 20 * MIN);
    log = addInterval(log, "a", "listening", at(30, 18), at(30, 18) + 5 * MIN);
    expect(resumeModeFor(log, "a", now)).toBe("listen");
    expect(lastSession(log, "a")).toEqual({ mode: "listen", at: at(30, 18) });
    log = addInterval(log, "a", "reading", at(1, 8), at(1, 8) + 2 * MIN);
    expect(resumeModeFor(log, "a", now)).toBe("read");
  });

  it("falls back to how Votic is used lately, then to reading", () => {
    expect(resumeModeFor(emptyLog(0), "new", now)).toBe("read");
    const listener = addInterval(emptyLog(0), "other", "listening", at(29, 9), at(29, 9) + 30 * MIN);
    expect(resumeModeFor(listener, "new", now)).toBe("listen");
  });
});

describe("this week", () => {
  it("totals reading and listening by day, Monday to Sunday", () => {
    let log = addInterval(emptyLog(0), "a", "reading", at(28, 9), at(28, 9) + 20 * MIN);
    log = addInterval(log, "a", "listening", at(1, 9), at(1, 9) + 10 * MIN);
    const week = weekActivity(log, now);
    expect(week.total).toBe(30 * MIN);
    expect(week.reading).toBe(20 * MIN);
    expect(week.days.map((day) => day.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(week.days.map((day) => day.total / MIN)).toEqual([20, 0, 0, 10, 0, 0, 0]);
    expect(week.days.findIndex((day) => day.isToday)).toBe(3);
    // No activity last week, so no percentage.
    expect(week.change).toBeNull();
  });

  it("compares with last week only when both weeks have real activity", () => {
    let log = addInterval(emptyLog(0), "a", "reading", at(22, 9), at(22, 9) + 20 * MIN);
    log = addInterval(log, "a", "reading", at(29, 9), at(29, 9) + 30 * MIN);
    expect(weekActivity(log, now).change).toBeCloseTo(0.5);
    expect(changeLabel(0.5)).toBe("Up 50% from last week");
    expect(changeLabel(-0.054)).toBe("Down 5% from last week");
    expect(changeLabel(0.001)).toBe("Same as last week");
  });
});

describe("personal insight", () => {
  it("stays quiet without enough activity", () => {
    const light = addInterval(emptyLog(0), "a", "listening", at(1, 9), at(1, 9) + 40 * MIN);
    expect(homeInsight(light, [], now)).toBeNull();
  });

  it("states facts from measured time and finished documents", () => {
    let log = emptyLog(0);
    for (const day of [28, 29, 30])
      log = addInterval(log, "a", "listening", at(day, 19), at(day, 19) + 20 * MIN);
    expect(homeInsight(log, [], now)).toBe("Most of your time with Votic this week was listening.");
    const finished = [doc("x", { completedAt: at(1, 8) }), doc("y", { completedAt: at(1, 9) })];
    expect(homeInsight(log, finished, now)).toBe("You've finished 2 documents this month.");
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
    expect(homeNotes(documents).map((item) => item.passage.id)).toEqual(["old-pinned", "newest", "middle"]);
    expect(homeNotes(documents, 1)).toHaveLength(1);
  });

  it("names recent days plainly", () => {
    expect(relativeDay(at(1, 8), now)).toBe("Today");
    expect(relativeDay(at(30, 23), now)).toBe("Yesterday");
    expect(relativeDay(at(27, 8), now)).toBe("4 days ago");
  });
});
