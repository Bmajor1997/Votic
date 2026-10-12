import { describe, expect, it } from "vitest";
import { add_interval, empty_log } from "../activity/activityModel";
import { VoticDocument } from "../documents/types";
import { widget_link_target } from "./widgetLinks";
import {
  build_widget_snapshot,
  signed_out_snapshot,
  UP_NEXT_LIMIT,
  WIDGET_DAYS,
  widget_days,
} from "./widgetSnapshot";

const MIN = 60_000;
// Friday, October 9, 2026, at noon local time.
const now = new Date(2026, 9, 9, 12);
const at = (month: number, day: number, hour: number) => new Date(2026, month, day, hour).getTime();
const doc = (id: string, extra: Partial<VoticDocument> = {}): VoticDocument => ({
  id,
  title: id,
  sourceName: `${id}.pdf`,
  plainText: Array.from({ length: 2000 }, () => "word").join(" "),
  importedAt: 1,
  updatedAt: 1,
  progress: 0,
  sentenceIndex: 0,
  wordIndex: 0,
  playbackRate: 1,
  ...extra,
});

describe("widget snapshot", () => {
  it("leads with the unfinished document opened most recently", () => {
    const log = add_interval(empty_log(0), "report", "listening", at(9, 9, 8), at(9, 9, 8) + 20 * MIN);
    const snapshot = build_widget_snapshot({
      documents: [
        doc("finished", { progress: 1, lastOpenedAt: 50 }),
        doc("report", { title: "q3_board-report_FINAL", progress: 0.42, lastOpenedAt: 40 }),
        doc("lease", { sourceName: "lease.docx", lastOpenedAt: 30 }),
      ],
      log,
      signedIn: true,
      now,
    });
    expect(snapshot.continue).toEqual({
      id: "report",
      title: "q3 board report FINAL",
      kind: "PDF",
      tone: "pdf",
      progress: 0.42,
      status: "42% · about 6 min left",
      mode: "listen",
    });
    // Unfinished documents come before finished ones in Up next.
    expect(snapshot.upNext.map((item) => [item.id, item.status, item.kind])).toEqual([
      ["lease", "Not started", "Word"],
      ["finished", "Finished", "PDF"],
    ]);
    expect(snapshot.documentCount).toBe(3);
  });

  it("keeps Up next short and leaves Quick Notes out", () => {
    const documents = [
      doc("quick", { notebookKind: "quick-notes", lastOpenedAt: 99 }),
      ...Array.from({ length: 6 }, (_, index) => doc(`d${index}`, { lastOpenedAt: 10 - index })),
    ];
    const snapshot = build_widget_snapshot({ documents, log: empty_log(0), signedIn: true, now });
    expect(snapshot.continue?.id).toBe("d0");
    expect(snapshot.upNext).toHaveLength(UP_NEXT_LIMIT);
    expect(snapshot.documentCount).toBe(6);
    expect(JSON.stringify(snapshot)).not.toContain("quick");
  });

  it("never carries document text, only what the widgets draw", () => {
    const secret = "The confidential paragraph.";
    const snapshot = build_widget_snapshot({
      documents: [
        doc("notes", {
          plainText: secret,
          progress: 0.5,
          savedPassages: [
            { id: "p", sentenceIndex: 0, text: secret, note: "a note", createdAt: 1, updatedAt: 1 },
          ],
        }),
      ],
      log: empty_log(0),
      signedIn: true,
      now,
    });
    expect(JSON.stringify(snapshot)).not.toContain("confidential");
    expect(JSON.stringify(snapshot)).not.toContain("a note");
  });

  it("shortens very long titles", () => {
    const snapshot = build_widget_snapshot({
      documents: [doc("long", { title: "A ".repeat(200) + "title" })],
      log: empty_log(0),
      signedIn: true,
      now,
    });
    expect(snapshot.continue!.title.length).toBeLessThanOrEqual(120);
    expect(snapshot.continue!.title.endsWith("…")).toBe(true);
  });

  it("shows nothing from the library when signed out", () => {
    const snapshot = build_widget_snapshot({
      documents: [doc("report", { progress: 0.4 })],
      log: add_interval(empty_log(0), "report", "reading", at(9, 9, 8), at(9, 9, 8) + 20 * MIN),
      signedIn: false,
      now,
    });
    expect(snapshot).toEqual(signed_out_snapshot());
    expect(snapshot.signedIn).toBe(false);
  });

  it("is empty, not missing, with no documents yet", () => {
    const snapshot = build_widget_snapshot({ documents: [], log: empty_log(0), signedIn: true, now });
    expect(snapshot).toMatchObject({
      signedIn: true,
      continue: null,
      upNext: [],
      documentCount: 0,
      days: [],
    });
  });
});

describe("daily totals for the widgets", () => {
  it("sends recent days with activity, newest first, in seconds", () => {
    let log = add_interval(empty_log(0), "a", "reading", at(9, 5, 9), at(9, 5, 9) + 20 * MIN);
    log = add_interval(log, "a", "listening", at(9, 9, 7), at(9, 9, 7) + 10 * MIN);
    log = add_interval(log, "b", "reading", at(9, 9, 10), at(9, 9, 10) + 5 * MIN);
    expect(widget_days(log, now)).toEqual([
      { date: "2026-10-09", readingSeconds: 300, listeningSeconds: 600 },
      { date: "2026-10-05", readingSeconds: 1200, listeningSeconds: 0 },
    ]);
  });

  it("leaves out days older than the widgets need", () => {
    const old = new Date(2026, 9, 9 - WIDGET_DAYS, 9).getTime();
    const edge = new Date(2026, 9, 9 - (WIDGET_DAYS - 1), 9).getTime();
    let log = add_interval(empty_log(0), "a", "reading", old, old + 5 * MIN);
    log = add_interval(log, "a", "reading", edge, edge + 5 * MIN);
    expect(widget_days(log, now).map((day) => day.date)).toEqual(["2026-08-29"]);
  });
});

describe("widget links", () => {
  const library = [{ id: "report" }];

  it("resumes a document the way the widget asked", () => {
    expect(widget_link_target({ open: "listen", id: "report" }, library)).toEqual({
      kind: "document",
      id: "report",
      mode: "listen",
    });
    expect(widget_link_target({ open: "read", id: ["report"] }, library)).toEqual({
      kind: "document",
      id: "report",
      mode: "read",
    });
  });

  it("falls back to Home for a document that's gone or a link it doesn't know", () => {
    expect(widget_link_target({ open: "listen", id: "deleted" }, library)).toEqual({ kind: "home" });
    expect(widget_link_target({ open: "listen" }, library)).toEqual({ kind: "home" });
    expect(widget_link_target({ open: "settings" }, library)).toEqual({ kind: "home" });
    expect(widget_link_target({}, library)).toEqual({ kind: "home" });
  });

  it("opens Statistics and Documents", () => {
    expect(widget_link_target({ open: "statistics" }, library)).toEqual({ kind: "statistics" });
    expect(widget_link_target({ open: "add" }, library)).toEqual({ kind: "documents" });
  });
});
