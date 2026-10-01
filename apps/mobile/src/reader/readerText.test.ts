import { describe, expect, it } from "vitest";
import {
  clockLabel,
  locationAtScroll,
  locationForProgress,
  passageTokens,
  progressForLocation,
  readerType,
  speechSegment,
  timeSpentLabel,
  wordAtSpeechOffset,
  wordMatches,
} from "./readerText";
import { uniqueEnglishVoices, voticVoiceName, voticVoicePreview } from "./voices";

// 3 + 2 + 5 = 10 words.
const passages = ["One two three.", "Four five.", "Six seven eight nine ten."];

describe("read mode position from scrolling", () => {
  // Each passage is 100 points tall; the viewport is 200 and the content 300.
  const layouts = { 0: { y: 0, height: 100 }, 1: { y: 100, height: 100 }, 2: { y: 200, height: 100 } };
  const at = (offset: number) =>
    locationAtScroll(passages, layouts, { offset, viewport: 200, contentHeight: 400 });

  it("starts at the first word when scrolled to the top", () => {
    expect(at(0)).toEqual({ sentenceIndex: 0, wordIndex: 0 });
    expect(progressForLocation(passages, 0, 0)).toBe(0);
  });

  it("follows the reading line through the document", () => {
    // Offset 120 puts the line at 120 + 90 = 210: just inside the third passage (5 words).
    expect(at(120)).toEqual({ sentenceIndex: 2, wordIndex: 0 });
    // Offset 60 puts the line at 120: 20% into the second passage (2 words).
    expect(at(60)).toEqual({ sentenceIndex: 1, wordIndex: 0 });
  });

  it("reaches the last word, and 100%, at the end of the document", () => {
    const end = at(200)!;
    expect(end).toEqual({ sentenceIndex: 2, wordIndex: 4 });
    expect(progressForLocation(passages, end.sentenceIndex, end.wordIndex)).toBe(1);
  });

  it("waits for layout before reporting a position", () => {
    expect(locationAtScroll(passages, layouts, { offset: 0, viewport: 0, contentHeight: 0 })).toBeNull();
    expect(locationAtScroll([], layouts, { offset: 0, viewport: 200, contentHeight: 300 })).toBeNull();
  });
});

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

// Each word's offset in the spoken string, as iOS/Android report it at a word boundary.
function boundaryOffsets(spoken: string) {
  return wordMatches(spoken).map((match) => match.index ?? 0);
}
// The word the Reader highlights for a word index (what the listener sees on screen).
function highlightedText(passage: string, word: number) {
  return passageTokens(passage).find((token) => token.word === word)?.text;
}

describe("speech and highlight stay on the same word", () => {
  const cases = {
    punctuation: `"Wait," she said — (quietly) — "it's 3:45 p.m., isn't it?!"`,
    "multiple spaces": "One   two  three    four.",
    "line breaks": "Chapter One\nThe   beginning\n\n  of the story.",
    paragraphs: "Intro heading\n\nFirst paragraph line.\r\n\r\nSecond\tparagraph line.",
    "long text": Array.from({ length: 400 }, (_, i) => `word${i},`).join(" \n "),
  };
  for (const [name, passage] of Object.entries(cases)) {
    it(`highlights the spoken word with ${name}`, () => {
      const words = wordMatches(passage);
      const segment = speechSegment(passage, 0);
      boundaryOffsets(segment.text).forEach((offset, word) => {
        expect(wordAtSpeechOffset(segment, offset)).toBe(word);
        expect(highlightedText(passage, word)).toBe(words[word][0]);
      });
    });
    it(`keeps the mapping after resuming mid-passage with ${name}`, () => {
      const words = wordMatches(passage);
      const resumeAt = Math.floor(words.length / 2);
      const segment = speechSegment(passage, resumeAt);
      expect(segment.text.startsWith(words[resumeAt][0])).toBe(true);
      boundaryOffsets(segment.text).forEach((offset, spoken) => {
        const word = wordAtSpeechOffset(segment, offset);
        expect(word).toBe(resumeAt + spoken);
        expect(highlightedText(passage, word!)).toBe(words[resumeAt + spoken][0]);
      });
    });
  }
  it("numbers displayed words exactly like spoken words", () => {
    for (const passage of Object.values(cases)) {
      const tokens = passageTokens(passage);
      expect(tokens.map((token) => token.text).join("")).toBe(passage);
      expect(tokens.filter((token) => token.word !== null).map((token) => token.text)).toEqual(
        wordMatches(passage).map((match) => match[0]),
      );
    }
  });
  it("maps boundaries inside a word, on whitespace, or past the end to the right word", () => {
    const segment = speechSegment("Alpha  beta,gamma delta", 0);
    expect(wordAtSpeechOffset(segment, 2)).toBe(0); // inside "Alpha"
    expect(wordAtSpeechOffset(segment, 6)).toBe(0); // in the double space after it
    expect(wordAtSpeechOffset(segment, 12)).toBe(1); // engine splits "beta,gamma" at "gamma"
    expect(wordAtSpeechOffset(segment, 999)).toBe(2);
    expect(wordAtSpeechOffset(segment, Number.NaN)).toBeNull();
  });
  it("never maps a resumed segment's boundary before where it resumed", () => {
    const segment = speechSegment("One two three four.", 2);
    expect(wordAtSpeechOffset(segment, 0)).toBe(2);
    expect(wordAtSpeechOffset(segment, -5)).toBe(2);
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
