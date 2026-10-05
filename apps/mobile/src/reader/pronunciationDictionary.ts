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
function escapeRegExp(value: string) { return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&"); }
export function applyPronunciations(text: string, entries: PronunciationEntry[]) {
  let spoken = text;
  for (const entry of [...entries].sort((a, b) => b.term.length - a.term.length)) {
    const pattern = new RegExp("(?<![\\p{L}\\p{N}])" + escapeRegExp(entry.term) + "(?![\\p{L}\\p{N}])", "giu");
    spoken = spoken.replace(pattern, entry.pronunciation);
  }
  return spoken;
}
