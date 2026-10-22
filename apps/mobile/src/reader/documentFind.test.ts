import { expect, it } from "vitest";
import { find_document_matches, literal_matches, match_context } from "./documentFind";

it("finds literal punctuation and Unicode without regex interpretation", () => {
  expect(literal_matches("Café (a+b).* café (a+b).* 日本語 😀", "(a+b).*")).toEqual([
    { offset: 5, length: 7 },
    { offset: 18, length: 7 },
  ]);
  expect(literal_matches("ÉTÉ été", "été")).toHaveLength(2);
  expect(literal_matches("日本語 😀", "😀")).toEqual([{ offset: 4, length: 2 }]);
  expect(literal_matches("abc", "")).toEqual([]);
});
it("returns document locations, no results, bounded matches, and canceled searches", async () => {
  expect(await find_document_matches(["First here", "Second here"], "here", () => false)).toEqual([
    { passage: 0, offset: 6, length: 4 },
    { passage: 1, offset: 7, length: 4 },
  ]);
  expect(await find_document_matches(["a"], "missing", () => false)).toEqual([]);
  expect(await find_document_matches(["a".repeat(5000)], "a", () => false)).toHaveLength(1001);
  expect(await find_document_matches(["a"], "a", () => true)).toEqual([]);
});

it("preserves original highlight offsets across Unicode case pairs without expanding characters", () => {
  expect(literal_matches("İ before ÉTÉ 😀 𐐀", "été")).toEqual([{ offset: 9, length: 3 }]);
  expect(literal_matches("İ i ı I", "i")).toEqual([
    { offset: 2, length: 1 },
    { offset: 6, length: 1 },
  ]);
  expect(literal_matches("Σ σ ς", "σ")).toEqual([
    { offset: 0, length: 1 },
    { offset: 2, length: 1 },
    { offset: 4, length: 1 },
  ]);
  expect(literal_matches("K K k", "k")).toHaveLength(3);
  expect(literal_matches("ſ S s", "s")).toHaveLength(3);
  expect(literal_matches("ß ẞ ss", "ß")).toEqual([
    { offset: 0, length: 1 },
    { offset: 2, length: 1 },
  ]);
  expect(literal_matches("😀𐐀𐐨", "𐐨")).toEqual([
    { offset: 2, length: 2 },
    { offset: 4, length: 2 },
  ]);
});

it("treats hostile-looking queries literally and bounds repeated-prefix matches", () => {
  expect(literal_matches("a".repeat(200000), "(a+)+$")).toEqual([]);
  expect(literal_matches("a".repeat(200000) + "b", "a".repeat(119) + "b")).toEqual([
    { offset: 199881, length: 120 },
  ]);
  expect(literal_matches("ababa", "aba")).toEqual([{ offset: 0, length: 3 }]);
  expect(literal_matches("aaaa", "a", 0)).toEqual([]);
  expect(literal_matches("aaaa", "a", 2)).toEqual([
    { offset: 0, length: 1 },
    { offset: 1, length: 1 },
  ]);
});

it("finds curly apostrophes and quotes from typed straight ones, keeping highlight offsets", () => {
  expect(literal_matches("We don’t stop. “Quoted” text.", "don't")).toEqual([{ offset: 3, length: 5 }]);
  expect(literal_matches("We don’t stop. “Quoted” text.", '"quoted"')).toEqual([{ offset: 15, length: 8 }]);
  expect(literal_matches("It's plain ASCII.", "it’s")).toEqual([{ offset: 0, length: 4 }]);
});

it("describes the words around a match for screen readers", () => {
  const text = "The lighthouse keeper climbed the stairs every evening to light the great lamp before dark.";
  const offset = text.indexOf("light the");
  expect(match_context(text, { offset, length: 5 }, 20)).toBe("…every evening to light the great lamp…");
  expect(match_context("Short line.", { offset: 0, length: 5 })).toBe("Short line.");
});
