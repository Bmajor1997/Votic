import { describe, expect, it } from "vitest";
import { most_recent_incomplete } from "./insights";
import { VoticDocument } from "./types";

const doc = (id: string, fields: Partial<VoticDocument>): VoticDocument => ({
  id,
  title: id,
  sourceName: `${id}.txt`,
  plainText: "Text.",
  importedAt: 1,
  updatedAt: 1,
  progress: 0,
  sentenceIndex: 0,
  wordIndex: 0,
  playbackRate: 1,
  ...fields,
});

describe("most_recent_incomplete", () => {
  it("keeps the started document even when a new one was opened later", () => {
    const reading = doc("reading", { progress: 0.13, sentenceIndex: 30, lastOpenedAt: 100 });
    const glanced = doc("glanced", { lastOpenedAt: 200 });
    expect(most_recent_incomplete([glanced, reading])?.id).toBe("reading");
  });

  it("prefers the most recently opened of several started documents", () => {
    const older = doc("older", { progress: 0.5, lastOpenedAt: 100 });
    const newer = doc("newer", { progress: 0.1, lastOpenedAt: 300 });
    expect(most_recent_incomplete([older, newer])?.id).toBe("newer");
  });

  it("offers a not-started document when nothing is in progress", () => {
    const fresh = doc("fresh", { lastOpenedAt: 100 });
    const finished = doc("finished", { progress: 1, lastOpenedAt: 200 });
    expect(most_recent_incomplete([fresh, finished])?.id).toBe("fresh");
  });

  it("returns nothing when everything is finished", () => {
    expect(most_recent_incomplete([doc("done", { progress: 1 })])).toBeUndefined();
  });
});
