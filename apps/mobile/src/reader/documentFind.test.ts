import { expect, it } from "vitest";
import { find_document_matches, literal_matches } from "./documentFind";

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
