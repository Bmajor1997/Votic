import { describe, expect, it } from "vitest";
import { featured_voices, voice_accent, voice_detail } from "./voiceDetails";

const voice = (identifier: string, language: string, name = identifier) => ({ identifier, name, language });

describe("voice details", () => {
  it("names the accent from the language tag, with plain English as the fallback", () => {
    expect(voice_accent(voice("a", "en-GB"))).toBe("British English");
    expect(voice_accent(voice("a", "en_AU"))).toBe("Australian English");
    expect(voice_accent(voice("a", "en-us"))).toBe("US English");
    expect(voice_accent(voice("a", "en"))).toBe("English");
    expect(voice_accent(voice("a", "en-XX"))).toBe("English");
  });
  it("says when a voice needs an internet connection", () => {
    expect(voice_detail(voice("en-gb-x-abc-network", "en-GB"))).toBe("British English · Needs internet");
    expect(voice_detail(voice("en-gb-x-abc-local", "en-GB"))).toBe("British English");
  });
  it("puts the chosen voice first and limits the choices, without reordering the rest", () => {
    const voices = ["a", "b", "c", "d", "e"].map((id) => voice(id, "en-US"));
    expect(featured_voices(voices, "d", 3).map((v) => v.identifier)).toEqual(["d", "a", "b"]);
    expect(featured_voices(voices, null, 2).map((v) => v.identifier)).toEqual(["a", "b"]);
    expect(featured_voices(voices, "missing", 2).map((v) => v.identifier)).toEqual(["a", "b"]);
  });
});
