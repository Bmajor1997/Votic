import { describe, expect, it } from "@jest/globals";
import {
  notification_passages,
  notification_payload,
  valid_playback_state,
} from "../../src/playback/notificationPlayback";

describe("notification narration", () => {
  it("keeps original word positions when pronunciations expand a word", () => {
    const [passage] = notification_passages(
      ["Votic reads clearly."],
      [{ id: "votic", term: "Votic", pronunciation: "voh tick" }],
    );
    expect(passage.text).toBe("voh tick reads clearly.");
    expect(passage.offsets).toEqual([0, 4, 9, 15]);
    expect(passage.words[0]).toBe(0);
    expect(passage.words.at(-1)).toBe(2);
    expect(passage.words.every((word) => word >= 0 && word <= 2)).toBe(true);
  });
  it("passes the complete document queue and selected voice to native playback", () => {
    const payload = JSON.parse(
      notification_payload(
        "account-a",
        { id: "doc-a", title: "Field guide" },
        ["First page.", "Second page."],
        [],
        1,
        1,
        4,
        "voice-a",
      ),
    );
    expect(payload).toMatchObject({
      accountId: "account-a",
      documentId: "doc-a",
      passageIndex: 1,
      wordIndex: 1,
      rate: 4,
      voice: "voice-a",
    });
    expect(payload.passages).toEqual([
      { text: "First page.", offsets: [0, 6], words: [0, 1] },
      { text: "Second page.", offsets: [0, 7], words: [0, 1] },
    ]);
  });
  it("rejects another account's playback and invalid native positions", () => {
    const state = {
      accountId: "account-a",
      documentId: "doc-a",
      passageIndex: 0,
      wordIndex: 1,
      playing: true,
      completed: false,
    };
    expect(valid_playback_state(state, "account-a")).toBe(true);
    expect(valid_playback_state(state, "account-b")).toBe(false);
    expect(valid_playback_state(state, null)).toBe(false);
    expect(valid_playback_state({ ...state, wordIndex: -1 }, "account-a")).toBe(false);
    expect(valid_playback_state({ ...state, passageIndex: NaN }, "account-a")).toBe(false);
  });
});
