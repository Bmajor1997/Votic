import { describe, expect, it } from "vitest";
import {
  clockLabel,
  locationForProgress,
  progressForLocation,
  readerType,
  speechSegment,
  timeSpentLabel,
} from "./readerText";
import { uniqueEnglishVoices, voticVoiceName, voticVoicePreview } from "./voices";

// 3 + 2 + 5 = 10 words.
const passages = ["One two three.", "Four five.", "Six seven eight nine ten."];

describe("reading position", () => {
  it("maps progress to a passage and word", () => {
    expect(locationForProgress(passages, 0)).toEqual({ sentenceIndex: 0, wordIndex: 0 });
    expect(locationForProgress(passages, 0.35)).toEqual({ sentenceIndex: 1, wordIndex: 0 });
    expect(locationForProgress(passages, 1)).toEqual({ sentenceIndex: 2, wordIndex: 4 });
  });
  it("maps a passage and word back to progress", () => {
    expect(progressForLocation(passages, 0, 0)).toBe(0);
    expect(progressForLocation(passages, 1, 1)).toBeCloseTo(4 / 9);
    expect(progressForLocation(passages, 2, 4)).toBe(1);
  });
  it("finds the same word it was given, for every word", () => {
    for (let word = 0; word < 10; word += 1) {
      // Word n of 10 starts at progress n/10; its position as progress is n/9 (first=0, last=1).
      const location = locationForProgress(passages, word / 10);
      expect(progressForLocation(passages, location.sentenceIndex, location.wordIndex)).toBeCloseTo(word / 9);
    }
  });
  it("clamps out-of-range values", () => {
    expect(locationForProgress(passages, -1)).toEqual({ sentenceIndex: 0, wordIndex: 0 });
    expect(locationForProgress(passages, 2)).toEqual({ sentenceIndex: 2, wordIndex: 4 });
    expect(progressForLocation(passages, 0, 99)).toBeCloseTo(2 / 9);
  });
  it("handles empty and one-word documents", () => {
    expect(locationForProgress([], 0.5)).toEqual({ sentenceIndex: 0, wordIndex: 0 });
    expect(progressForLocation([], 0, 0)).toBe(0);
    expect(progressForLocation(["Hello."], 0, 0)).toBe(1);
  });
});

describe("speech segments", () => {
  it("resumes speaking from a word", () => {
    const segment = speechSegment("Four five six.", 1);
    expect(segment.text).toBe("five six.");
    expect(segment.startChar).toBe(5);
    expect(segment.startWord).toBe(1);
  });
  it("clamps a word index past the end", () => {
    expect(speechSegment("Four five.", 9).text).toBe("five.");
  });
});

describe("labels", () => {
  it("formats time spent", () => {
    expect(timeSpentLabel(10)).toBe("<1 min");
    expect(timeSpentLabel(600)).toBe("10 min");
    expect(timeSpentLabel(3600)).toBe("1 hr");
    expect(timeSpentLabel(5400)).toBe("1 hr 30 min");
  });
  it("formats a playback clock", () => {
    expect(clockLabel(0)).toBe("0:00");
    expect(clockLabel(75.4)).toBe("1:15");
    expect(clockLabel(-3)).toBe("0:00");
  });
});

describe("reader text style", () => {
  it("scales size and line height from preferences", () => {
    expect(readerType("default", "default", "system", "default")).toEqual({
      fontSize: 18,
      lineHeight: 30,
      letterSpacing: 0,
      fontFamily: undefined,
    });
    expect(readerType("extra-large", "extra", "serif", "wide")).toEqual({
      fontSize: 25,
      lineHeight: 48,
      letterSpacing: 0.75,
      fontFamily: "serif",
    });
  });
});

describe("Votic voices", () => {
  it("names voices and falls back past the named ones", () => {
    expect(voticVoiceName(0)).toBe("Arden");
    expect(voticVoiceName(8)).toBe("Voice 9");
    expect(voticVoicePreview(8)).toContain("Voice 9");
  });
  it("keeps one English voice per name", () => {
    const voices = [
      { identifier: "a", name: "Samantha", language: "en-US" },
      { identifier: "b", name: "samantha ", language: "en-GB" },
      { identifier: "c", name: "Amélie", language: "fr-CA" },
      { identifier: "d", name: "Daniel", language: "EN-gb" },
    ];
    expect(uniqueEnglishVoices(voices).map((voice) => voice.identifier)).toEqual(["a", "d"]);
  });
});
