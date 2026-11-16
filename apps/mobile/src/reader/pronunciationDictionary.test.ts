import { describe, expect, it, vi } from "vitest";
import { apply_pronunciations, normalize_pronunciation_entry, pronounce } from "./pronunciationDictionary";

// vi.mock calls are hoisted above the imports.

vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("../storage/accountStorage", () => ({
  account_storage_key: (key: string, uid: string) => key + uid,
}));
vi.mock("../storage/accountDeletion", () => ({
  write_account_data: async (_uid: string, write: () => unknown) => write(),
}));

const entry = normalize_pronunciation_entry;

describe("pronunciation dictionary", () => {
  it("replaces whole words in any capitalization and leaves longer words alone", () => {
    expect(
      apply_pronunciations("I love Votic and votic. Voticness Votic's", [entry("Votic", "VOH-tick")]),
    ).toBe("I love VOH-tick and VOH-tick. Voticness VOH-tick's");
  });

  it("matches an all-capitals acronym only in capitals, so ordinary words are not changed", () => {
    expect(apply_pronunciations("Tell us about the US.", [entry("US", "United States")])).toBe(
      "Tell us about the United States.",
    );
    expect(apply_pronunciations("NASA, not nasal.", [entry("NASA", "nah suh")])).toBe("nah suh, not nasal.");
  });

  it("finds a phrase split across a line break or extra spaces", () => {
    const entries = [entry("New York", "Noo York")];
    expect(apply_pronunciations("New\nYork and New   York", entries)).toBe("Noo York and Noo York");
  });

  it("prefers the longest entry and never replaces a replacement again", () => {
    expect(
      apply_pronunciations("New York City", [entry("New York", "NY"), entry("New York City", "N Y C")]),
    ).toBe("N Y C");
    expect(apply_pronunciations("SQL", [entry("SQL", "sequel"), entry("sequel", "SEE-kwul")])).toBe("sequel");
  });

  it("handles symbols and accented letters", () => {
    expect(apply_pronunciations("I use C++ daily", [entry("C++", "C plus plus")])).toBe(
      "I use C plus plus daily",
    );
    expect(apply_pronunciations("café Café", [entry("café", "ka-fay")])).toBe("ka-fay ka-fay");
  });

  it("keeps the highlight on the word being spoken when a pronunciation has more words", () => {
    const source = "NASA launched a rocket from the cape";
    const spoken = pronounce(source, [entry("NASA", "the national aeronautics and space administration")]);
    const word_for = (spokenWord: string) =>
      source.split(" ")[spoken.source_word_at(spoken.text.indexOf(spokenWord))];
    expect(word_for("national")).toBe("NASA");
    expect(word_for("administration")).toBe("NASA");
    expect(word_for("launched")).toBe("launched");
    expect(word_for("rocket")).toBe("rocket");
    expect(word_for("cape")).toBe("cape");
  });

  it("keeps the highlight right when a pronunciation has fewer words", () => {
    const source = "Visit New York City today";
    const spoken = pronounce(source, [entry("New York City", "Nyc")]);
    expect(spoken.text).toBe("Visit Nyc today");
    expect(spoken.source_word_at(spoken.text.indexOf("today"))).toBe(4);
    expect(spoken.source_word_at(spoken.text.indexOf("Nyc"))).toBe(1);
  });

  it("speaks the text unchanged with no entries", () => {
    const spoken = pronounce("Plain words here", []);
    expect(spoken.text).toBe("Plain words here");
    expect(spoken.source_word_at(6)).toBe(1);
  });
});
