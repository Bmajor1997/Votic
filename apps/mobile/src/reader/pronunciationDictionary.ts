import AsyncStorage from "@react-native-async-storage/async-storage";

export type PronunciationEntry = { id: string; term: string; pronunciation: string };
const KEY = "@votic/pronunciation-dictionary/v1";

export async function loadPronunciations(): Promise<PronunciationEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PronunciationEntry =>
      item && typeof item.id === "string" && typeof item.term === "string" &&
      typeof item.pronunciation === "string" && Boolean(item.term.trim()) && Boolean(item.pronunciation.trim()));
  } catch { return []; }
}
export async function savePronunciations(entries: PronunciationEntry[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries.slice(0, 250)));
}
export function normalizePronunciationEntry(term: string, pronunciation: string): PronunciationEntry {
  const cleanTerm = term.trim().replace(/\s+/g, " ").slice(0, 120);
  const cleanPronunciation = pronunciation.trim().replace(/\s+/g, " ").slice(0, 180);
  if (!cleanTerm || !cleanPronunciation) throw new Error("Enter both a word and how Votic should say it.");
  return { id: cleanTerm.toLocaleLowerCase(), term: cleanTerm, pronunciation: cleanPronunciation };
}
function isWordCharacter(value: string | undefined) {
  return Boolean(value && /[\p{L}\p{N}]/u.test(value));
}
function replaceWholeTerm(text: string, term: string, pronunciation: string) {
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
    const hasBoundaryBefore = index === 0 || !isWordCharacter(text[index - 1]);
    const hasBoundaryAfter = end === text.length || !isWordCharacter(text[end]);
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
export function applyPronunciations(text: string, entries: PronunciationEntry[]) {
  let spoken = text;
  for (const entry of [...entries].sort((a, b) => b.term.length - a.term.length)) {
    spoken = replaceWholeTerm(spoken, entry.term, entry.pronunciation);
  }
  return spoken;
}

export function sourceWordAtSpokenOffset(sourceText: string, spokenText: string, charIndex: number) {
  const sourceWords = [...sourceText.matchAll(/\S+/g)];
  const spokenWords = [...spokenText.matchAll(/\S+/g)];
  if (!sourceWords.length || !spokenWords.length) return 0;
  let spokenIndex = 0;
  for (let i = 0; i < spokenWords.length; i += 1) {
    if ((spokenWords[i].index ?? 0) > Math.max(0, charIndex)) break;
    spokenIndex = i;
  }
  return Math.min(sourceWords.length - 1, Math.round((spokenIndex / Math.max(1, spokenWords.length - 1)) * Math.max(0, sourceWords.length - 1)));
}
