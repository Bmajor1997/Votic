import { describe, expect, it } from "vitest";
import {
  clock_label,
  location_at_scroll,
  location_for_progress,
  passage_tokens,
  progress_for_location,
  reader_type,
  speech_segment,
  time_spent_label,
  word_at_speech_offset,
  word_matches,
} from "./readerText";
import { unique_english_voices, votic_voice_names, votic_voice_preview, device_voice_gender } from "./voices";
import { ACCESSIBLE_FONT } from "./readerFontNames";

// 3 + 2 + 5 = 10 words.
const passages = ["One two three.", "Four five.", "Six seven eight nine ten."];

describe("read mode position from scrolling", () => {
  // Each passage is 100 points tall; the viewport is 200 and the content 300.
  const layouts = { 0: { y: 0, height: 100 }, 1: { y: 100, height: 100 }, 2: { y: 200, height: 100 } };
  const at = (offset: number) =>
    location_at_scroll(passages, layouts, { offset, viewport: 200, contentHeight: 400 });

  it("starts at the first word when scrolled to the top", () => {
    expect(at(0)).toEqual({ sentenceIndex: 0, wordIndex: 0 });
    expect(progress_for_location(passages, 0, 0)).toBe(0);
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
    expect(progress_for_location(passages, end.sentenceIndex, end.wordIndex)).toBe(1);
  });

  it("waits for layout before reporting a position", () => {
    expect(location_at_scroll(passages, layouts, { offset: 0, viewport: 0, contentHeight: 0 })).toBeNull();
    expect(location_at_scroll([], layouts, { offset: 0, viewport: 200, contentHeight: 300 })).toBeNull();
  });
});

describe("reading position", () => {
  it("maps progress to a passage and word", () => {
    expect(location_for_progress(passages, 0)).toEqual({ sentenceIndex: 0, wordIndex: 0 });
    expect(location_for_progress(passages, 0.35)).toEqual({ sentenceIndex: 1, wordIndex: 0 });
    expect(location_for_progress(passages, 1)).toEqual({ sentenceIndex: 2, wordIndex: 4 });
  });
  it("maps a passage and word back to progress", () => {
    expect(progress_for_location(passages, 0, 0)).toBe(0);
    expect(progress_for_location(passages, 1, 1)).toBeCloseTo(4 / 9);
    expect(progress_for_location(passages, 2, 4)).toBe(1);
  });
  it("finds the same word it was given, for every word", () => {
    for (let word = 0; word < 10; word += 1) {
      // Word n of 10 starts at progress n/10; its position as progress is n/9 (first=0, last=1).
      const location = location_for_progress(passages, word / 10);
      expect(progress_for_location(passages, location.sentenceIndex, location.wordIndex)).toBeCloseTo(
        word / 9,
      );
    }
  });
  it("clamps out-of-range values", () => {
    expect(location_for_progress(passages, -1)).toEqual({ sentenceIndex: 0, wordIndex: 0 });
    expect(location_for_progress(passages, 2)).toEqual({ sentenceIndex: 2, wordIndex: 4 });
    expect(progress_for_location(passages, 0, 99)).toBeCloseTo(2 / 9);
  });
  it("handles empty and one-word documents", () => {
    expect(location_for_progress([], 0.5)).toEqual({ sentenceIndex: 0, wordIndex: 0 });
    expect(progress_for_location([], 0, 0)).toBe(0);
    expect(progress_for_location(["Hello."], 0, 0)).toBe(1);
  });
});

describe("speech segments", () => {
  it("resumes speaking from a word", () => {
    const segment = speech_segment("Four five six.", 1);
    expect(segment.text).toBe("five six.");
    expect(segment.startChar).toBe(5);
    expect(segment.startWord).toBe(1);
  });
  it("clamps a word index past the end", () => {
    expect(speech_segment("Four five.", 9).text).toBe("five.");
  });
});

// Each word's offset in the spoken string, as iOS/Android report it at a word boundary.
function boundary_offsets(spoken: string) {
  return word_matches(spoken).map((match) => match.index ?? 0);
}
// The word the Reader highlights for a word index (what the listener sees on screen).
function highlighted_text(passage: string, word: number) {
  return passage_tokens(passage).find((token) => token.word === word)?.text;
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
      const words = word_matches(passage);
      const segment = speech_segment(passage, 0);
      boundary_offsets(segment.text).forEach((offset, word) => {
        expect(word_at_speech_offset(segment, offset)).toBe(word);
        expect(highlighted_text(passage, word)).toBe(words[word][0]);
      });
    });
    it(`keeps the mapping after resuming mid-passage with ${name}`, () => {
      const words = word_matches(passage);
      const resumeAt = Math.floor(words.length / 2);
      const segment = speech_segment(passage, resumeAt);
      expect(segment.text.startsWith(words[resumeAt][0])).toBe(true);
      boundary_offsets(segment.text).forEach((offset, spoken) => {
        const word = word_at_speech_offset(segment, offset);
        expect(word).toBe(resumeAt + spoken);
        expect(highlighted_text(passage, word!)).toBe(words[resumeAt + spoken][0]);
      });
    });
  }
  it("numbers displayed words exactly like spoken words", () => {
    for (const passage of Object.values(cases)) {
      const tokens = passage_tokens(passage);
      expect(tokens.map((token) => token.text).join("")).toBe(passage);
      expect(tokens.filter((token) => token.word !== null).map((token) => token.text)).toEqual(
        word_matches(passage).map((match) => match[0]),
      );
    }
  });
  it("maps boundaries inside a word, on whitespace, or past the end to the right word", () => {
    const segment = speech_segment("Alpha  beta,gamma delta", 0);
    expect(word_at_speech_offset(segment, 2)).toBe(0); // inside "Alpha"
    expect(word_at_speech_offset(segment, 6)).toBe(0); // in the double space after it
    expect(word_at_speech_offset(segment, 12)).toBe(1); // engine splits "beta,gamma" at "gamma"
    expect(word_at_speech_offset(segment, 999)).toBe(2);
    expect(word_at_speech_offset(segment, Number.NaN)).toBeNull();
  });
  it("never maps a resumed segment's boundary before where it resumed", () => {
    const segment = speech_segment("One two three four.", 2);
    expect(word_at_speech_offset(segment, 0)).toBe(2);
    expect(word_at_speech_offset(segment, -5)).toBe(2);
  });
});

describe("labels", () => {
  it("formats time spent", () => {
    expect(time_spent_label(10)).toBe("<1 min");
    expect(time_spent_label(600)).toBe("10 min");
    expect(time_spent_label(3600)).toBe("1 hr");
    expect(time_spent_label(5400)).toBe("1 hr 30 min");
  });
  it("formats a playback clock", () => {
    expect(clock_label(0)).toBe("0:00");
    expect(clock_label(75.4)).toBe("1:15");
    expect(clock_label(-3)).toBe("0:00");
  });
});

describe("reader text style", () => {
  it("scales size and line height from preferences", () => {
    expect(reader_type("default", "default", "system", "default")).toEqual({
      fontSize: 18,
      lineHeight: 30,
      letterSpacing: 0,
      fontFamily: undefined,
    });
    expect(reader_type("extra-large", "extra", "serif", "wide")).toEqual({
      fontSize: 25,
      lineHeight: 48,
      letterSpacing: 0.75,
      fontFamily: "serif",
    });
  });

  it("uses the bundled Atkinson Hyperlegible for the easier-to-read font, not the system font", () => {
    // "sans-serif" is the system font on Android, so the option used to change nothing.
    expect(reader_type("default", "default", "accessible", "default").fontFamily).toBe(ACCESSIBLE_FONT);
    expect(ACCESSIBLE_FONT).toBe("AtkinsonHyperlegible_400Regular");
  });
});

describe("Votic voices", () => {
  it("names voices by explicit gender and stable identity, never list order", () => {
    const female = { identifier: "engine-female-en", name: "Female", language: "en-US" };
    const male = { identifier: "engine-male-en", name: "Male", language: "en-US" };
    expect(device_voice_gender(female)).toBe("female");
    expect(device_voice_gender(male)).toBe("male");
    const names = votic_voice_names([male, female]);
    expect(["Mira", "Kaia", "Nyla", "Elara", "Clara", "Sofia", "Emma", "Lily"]).toContain(
      names[female.identifier],
    );
    expect(["Daniel", "Soren", "Kellan", "Oliver", "James", "Noah", "Henry", "Leo"]).toContain(
      names[male.identifier],
    );
    // The OS's list order doesn't change anyone's name.
    expect(votic_voice_names([female, male])).toEqual(names);
    expect(votic_voice_preview(names[female.identifier])).toContain(names[female.identifier]);
  });
  it("gives Android voices real, different names instead of their codes", () => {
    const codes = [
      "en-us-x-tpf-local",
      "en-us-x-sfg-local",
      "en-us-x-iom-local",
      "en-gb-x-gba-local",
      "en-us-x-tpd-network",
    ];
    const voices = codes.map((code) => ({ identifier: code, name: code, language: "en-US" }));
    expect(device_voice_gender(voices[0])).toBeUndefined();
    const names = Object.values(votic_voice_names(voices));
    expect(names).toHaveLength(codes.length);
    expect(new Set(names).size).toBe(codes.length);
    for (const name of names) expect(name).toMatch(/^[A-Z][a-z]+$/);
  });
  it("still names every voice when there are more voices than names", () => {
    const voices = Array.from({ length: 20 }, (_, i) => ({
      identifier: `v${i}`,
      name: `v${i}`,
      language: "en-US",
    }));
    const names = Object.values(votic_voice_names(voices));
    expect(new Set(names).size).toBe(20);
    expect(names.every((name) => !/^v\d/.test(name))).toBe(true);
  });
  it("keeps one English voice per name", () => {
    const voices = [
      { identifier: "a", name: "Samantha", language: "en-US" },
      { identifier: "b", name: "samantha ", language: "en-GB" },
      { identifier: "c", name: "Amélie", language: "fr-CA" },
      { identifier: "d", name: "Daniel", language: "EN-gb" },
    ];
    expect(unique_english_voices(voices).map((voice) => voice.identifier)).toEqual(["a", "d"]);
  });
  it("keeps one copy of each Android voice, preferring the offline one", () => {
    const voices = [
      "en-us-x-iob-network",
      "en-us-x-iob-local",
      "en-gb-x-gba-network",
      "en-au-x-aua-local",
    ].map((name) => ({ identifier: name, name, language: "en-US" }));
    expect(unique_english_voices(voices).map((voice) => voice.identifier)).toEqual([
      "en-us-x-iob-local",
      "en-gb-x-gba-network",
      "en-au-x-aua-local",
    ]);
  });
  it("names 60 voices without falling back to numbers", () => {
    const voices = Array.from({ length: 60 }, (_, i) => ({
      identifier: `en-x-${i}-local`,
      name: `en-x-${i}-local`,
      language: "en-US",
    }));
    const names = Object.values(votic_voice_names(voices));
    expect(new Set(names).size).toBe(60);
    expect(names.some((name) => /\d/.test(name))).toBe(false);
  });
});
