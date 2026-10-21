import { describe, expect, it } from "vitest";
import { empty_log, parse_log } from "../activity/activityModel";
import { reconcile_native_documents, reconcile_native_log, valid_native_events } from "./nativeActivity";
import type { VoticDocument } from "../documents/types";

const start = new Date(2026, 9, 21, 10).getTime();
const event = { id: "session:book:hour", accountId: "A", documentId: "book", start, durationMs: 12_500 };
const document: VoticDocument = {
  id: "book",
  title: "Book",
  sourceName: "book.txt",
  plainText: "Book",
  importedAt: 1,
  updatedAt: 1,
  progress: 0,
  sentenceIndex: 0,
  wordIndex: 0,
  playbackRate: 1,
};
describe("native speech checkpoint reconciliation", () => {
  it("counts duplicate and out-of-order checkpoints once, including after a process restart", () => {
    const first = reconcile_native_log(empty_log(start), [event, event]);
    const restarted = parse_log(JSON.stringify(first))!;
    const next = reconcile_native_log(restarted, [{ ...event, durationMs: 15_000 }, event]);
    expect(
      Object.values(next.buckets)
        .flatMap(Object.values)
        .reduce((sum, split) => sum + split.listening, 0),
    ).toBe(15_000);
    expect(next.nativeCheckpoints?.[event.id]).toBe(15_000);
  });
  it("reconciles each store independently if a crash occurs between saves", () => {
    const activity = reconcile_native_log(empty_log(start), [event]);
    const documents = reconcile_native_documents([document], [event, event]);
    expect(reconcile_native_documents(JSON.parse(JSON.stringify(documents)), [event])).toEqual(documents);
    expect(reconcile_native_log(activity, [event])).toEqual(activity);
    expect(Object.values(documents[0].activity!)[0]).toEqual({
      readingSeconds: 12.5,
      listeningSeconds: 12.5,
    });
    expect(documents[0].progress).toBe(0);
  });
  it("splits measured speech at midnight without assigning paused wall-clock time", () => {
    const crossing = { ...event, start: new Date(2026, 9, 21, 23, 59, 55).getTime(), durationMs: 10_000 };
    const days = reconcile_native_documents([document], [crossing])[0].activity!;
    expect(Object.values(days).map((day) => day.listeningSeconds)).toEqual([5, 5]);
  });
  it("rejects foreign identities, nonfinite durations and excessive checkpoints", () => {
    expect(valid_native_events([event], "B")).toEqual([]);
    expect(
      valid_native_events(
        [
          { ...event, durationMs: Infinity },
          { ...event, durationMs: -1 },
          { ...event, durationMs: 3_600_001 },
        ],
        "A",
      ),
    ).toEqual([]);
    expect(valid_native_events([event], "A")).toEqual([event]);
  });
});
