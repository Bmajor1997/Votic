import AsyncStorage from "@react-native-async-storage/async-storage";
import { account_storage_key } from "../storage/accountStorage";
import { write_account_data } from "../storage/accountDeletion";

export type PronunciationEntry = { id: string; term: string; pronunciation: string };
const KEY = "@votic/pronunciation-dictionary/v1";

export async function load_pronunciations(uid?: string | null): Promise<PronunciationEntry[]> {
  if (!uid) return [];
  try {
    const key = account_storage_key(KEY, uid);
    let raw = await AsyncStorage.getItem(key);
    if (raw === null) {
      const explicit = await AsyncStorage.getItem("votic.mobile.legacy-library-owner.v1");
      const owner = explicit ?? (await AsyncStorage.getItem("votic.mobile.legacy-library-auto-owner.v1"));
      // Never assign an unowned shared dictionary to whichever account happens to sign in first.
      if (owner && JSON.parse(owner)?.uid === uid) {
        raw = await AsyncStorage.getItem(KEY);
        if (raw !== null) {
          const legacy = raw;
          await write_account_data(uid, async () => {
            await AsyncStorage.setItem(key, legacy);
            await AsyncStorage.removeItem(KEY);
          });
        }
      }
    }
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PronunciationEntry =>
        item &&
        typeof item.id === "string" &&
        typeof item.term === "string" &&
        typeof item.pronunciation === "string" &&
        Boolean(item.term.trim()) &&
        Boolean(item.pronunciation.trim()),
    );
  } catch {
    return [];
  }
}
export async function save_pronunciations(uid: string, entries: PronunciationEntry[]) {
  if (!uid) throw new Error("Sign in to save pronunciations.");
  await write_account_data(uid, () =>
    AsyncStorage.setItem(account_storage_key(KEY, uid), JSON.stringify(entries.slice(0, 250))),
  );
}
export function normalize_pronunciation_entry(term: string, pronunciation: string): PronunciationEntry {
  const cleanTerm = term.trim().replace(/\s+/g, " ").slice(0, 120);
  const cleanPronunciation = pronunciation.trim().replace(/\s+/g, " ").slice(0, 180);
  if (!cleanTerm || !cleanPronunciation) throw new Error("Enter both a word and how Votic should say it.");
  return { id: cleanTerm.toLocaleLowerCase(), term: cleanTerm, pronunciation: cleanPronunciation };
}
function is_word_character(value: string | undefined) {
  return Boolean(value && /[\p{L}\p{N}]/u.test(value));
}
function escape_pattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** An all-capitals entry (an acronym such as "US" or "NASA") only matches capitals, so it never changes "us". */
function is_acronym(term: string) {
  return /\p{Lu}/u.test(term) && !/\p{Ll}/u.test(term);
}
function entry_pattern(term: string) {
  // Words of a phrase may be split by any spacing in the document, including line breaks from PDFs.
  const source = term.trim().split(/\s+/).map(escape_pattern).join("\\s+");
  return new RegExp(source, is_acronym(term) ? "uy" : "iuy");
}

type SpokenPiece = { spokenStart: number; sourceStart: number; replaced: boolean };

/**
 * The text to speak with custom pronunciations applied, in one pass (a replacement is never replaced again), and a map
 * from a character the speech engine reports back to the word of the original text, so the highlight follows the voice
 * even when a pronunciation has a different number of words.
 */
export function pronounce(text: string, entries: PronunciationEntry[]) {
  const matchers = [...entries]
    .filter((entry) => entry.term.trim() && entry.pronunciation.trim())
    .sort((a, b) => b.term.length - a.term.length)
    .map((entry) => ({ pattern: entry_pattern(entry.term), pronunciation: entry.pronunciation }));
  const pieces: SpokenPiece[] = [];
  let spoken = "";
  let copiedFrom = 0;
  if (matchers.length) {
    for (let cursor = 0; cursor < text.length; cursor += 1) {
      if (cursor > 0 && is_word_character(text[cursor - 1])) continue;
      for (const matcher of matchers) {
        matcher.pattern.lastIndex = cursor;
        const match = matcher.pattern.exec(text);
        if (!match || !match[0]) continue;
        const end = cursor + match[0].length;
        if (end < text.length && is_word_character(text[end]) && is_word_character(text[end - 1])) continue;
        if (cursor > copiedFrom) {
          pieces.push({ spokenStart: spoken.length, sourceStart: copiedFrom, replaced: false });
          spoken += text.slice(copiedFrom, cursor);
        }
        pieces.push({ spokenStart: spoken.length, sourceStart: cursor, replaced: true });
        spoken += matcher.pronunciation;
        copiedFrom = end;
        cursor = end - 1;
        break;
      }
    }
  }
  if (copiedFrom < text.length || !pieces.length) {
    pieces.push({ spokenStart: spoken.length, sourceStart: copiedFrom, replaced: false });
    spoken += text.slice(copiedFrom);
  }
  const sourceWordStarts = [...text.matchAll(/\S+/g)].map((word) => word.index ?? 0);
  function source_word_at(charIndex: number) {
    const at = Math.max(0, Number.isFinite(charIndex) ? charIndex : 0);
    let piece = pieces[0];
    for (const candidate of pieces) {
      if (candidate.spokenStart > at) break;
      piece = candidate;
    }
    const sourceOffset = piece.replaced ? piece.sourceStart : piece.sourceStart + (at - piece.spokenStart);
    let word = 0;
    for (let i = 0; i < sourceWordStarts.length; i += 1) {
      if (sourceWordStarts[i] > sourceOffset) break;
      word = i;
    }
    return word;
  }
  return { text: spoken, source_word_at };
}

export function apply_pronunciations(text: string, entries: PronunciationEntry[]) {
  return pronounce(text, entries).text;
}
