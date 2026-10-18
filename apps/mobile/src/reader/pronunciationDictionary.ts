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
function replace_whole_term(text: string, term: string, pronunciation: string) {
  if (!term) return text;
  const lowerText = text.toLocaleLowerCase();
  const lowerTerm = term.toLocaleLowerCase();
  let cursor = 0;
  let result = "";
  while (cursor < text.length) {
    const index = lowerText.indexOf(lowerTerm, cursor);
    if (index < 0) {
      result += text.slice(cursor);
      break;
    }
    const end = index + term.length;
    const hasBoundaryBefore = index === 0 || !is_word_character(text[index - 1]);
    const hasBoundaryAfter = end === text.length || !is_word_character(text[end]);
    if (hasBoundaryBefore && hasBoundaryAfter) {
      result += text.slice(cursor, index) + pronunciation;
      cursor = end;
    } else {
      result += text.slice(cursor, end);
      cursor = end;
    }
  }
  return result;
}
export function apply_pronunciations(text: string, entries: PronunciationEntry[]) {
  let spoken = text;
  for (const entry of [...entries].sort((a, b) => b.term.length - a.term.length)) {
    spoken = replace_whole_term(spoken, entry.term, entry.pronunciation);
  }
  return spoken;
}

export function source_word_at_spoken_offset(sourceText: string, spokenText: string, charIndex: number) {
  const sourceWords = [...sourceText.matchAll(/\S+/g)];
  const spokenWords = [...spokenText.matchAll(/\S+/g)];
  if (!sourceWords.length || !spokenWords.length) return 0;
  let spokenIndex = 0;
  for (let i = 0; i < spokenWords.length; i += 1) {
    if ((spokenWords[i].index ?? 0) > Math.max(0, charIndex)) break;
    spokenIndex = i;
  }
  return Math.min(
    sourceWords.length - 1,
    Math.round((spokenIndex / Math.max(1, spokenWords.length - 1)) * Math.max(0, sourceWords.length - 1)),
  );
}
