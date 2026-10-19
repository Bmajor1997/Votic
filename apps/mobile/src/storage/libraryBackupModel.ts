import { ActivityLog, empty_log, parse_log } from "../activity/activityModel";
import { SavedPassage, VoticDocument } from "../documents/types";
import { SavedAccountPreferences } from "../onboarding/accountPreferences";
import { PronunciationEntry } from "../reader/pronunciationDictionary";

export const MAX_BACKUP_BYTES = 25_000_000;
/** The most documents and collections one library (or backup) can hold. */
export const MAX_LIBRARY_DOCUMENTS = 2000;
export const MAX_LIBRARY_COLLECTIONS = 2000;
export type LibraryBackup = {
  format: "votic-library";
  version: 1;
  id: string;
  createdAt: number;
  documents: VoticDocument[];
  collections: string[];
  activity: ActivityLog;
  pronunciations: PronunciationEntry[];
  preferences: SavedAccountPreferences | null;
};
const fail = () => {
  throw new Error("This is not a supported, complete Votic library backup.");
};
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  return value as Record<string, any>;
}
function text(value: unknown, max: number, empty = true): string {
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim())) return fail();
  return value;
}
function number(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) return fail();
  return value;
}
function integer(value: unknown): number {
  const n = number(value);
  if (!Number.isSafeInteger(n)) return fail();
  return n;
}
function list(value: unknown, max: number): any[] {
  if (!Array.isArray(value) || value.length > max) return fail();
  return value;
}
function note(value: unknown): SavedPassage {
  const n = object(value);
  if (n.noteType !== undefined && !["note", "key-point", "question", "definition"].includes(n.noteType))
    fail();
  if (n.pinned !== undefined && typeof n.pinned !== "boolean") fail();
  return {
    id: text(n.id, 200, false),
    sentenceIndex: integer(n.sentenceIndex),
    text: text(n.text, 100_000),
    note: text(n.note, 100_000),
    createdAt: number(n.createdAt),
    updatedAt: number(n.updatedAt),
    ...(n.title === undefined ? {} : { title: text(n.title, 500) }),
    ...(n.noteType === undefined ? {} : { noteType: n.noteType }),
    ...(n.pinned === undefined ? {} : { pinned: n.pinned }),
    ...(n.tags === undefined ? {} : { tags: list(n.tags, 100).map((t) => text(t, 200)) }),
  };
}
function document(value: unknown): VoticDocument {
  const d = object(value);
  if (d.origin !== undefined && !["file", "webpage", "scan", "guide"].includes(d.origin)) fail();
  if (d.notebookKind !== undefined && d.notebookKind !== "quick-notes") fail();
  const activity: NonNullable<VoticDocument["activity"]> = {};
  for (const [day, split] of Object.entries(object(d.activity ?? {}))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail();
    const s = object(split);
    activity[day] = {
      readingSeconds: number(s.readingSeconds),
      listeningSeconds: number(s.listeningSeconds),
    };
  }
  const responses: Record<string, string> = {};
  for (const [key, value] of Object.entries(object(d.reviewResponses ?? {})))
    responses[key] = text(value, 100_000);
  const rate = number(d.playbackRate, 3);
  if (rate < 0.5) fail();
  return {
    id: text(d.id, 200, false),
    title: text(d.title, 1000, false),
    sourceName: text(d.sourceName, 1000),
    plainText: text(d.plainText, 10_000_000),
    progress: number(d.progress, 1),
    sentenceIndex: integer(d.sentenceIndex),
    wordIndex: integer(d.wordIndex),
    playbackRate: rate,
    importedAt: number(d.importedAt),
    updatedAt: number(d.updatedAt),
    ...(d.lastOpenedAt === undefined ? {} : { lastOpenedAt: number(d.lastOpenedAt) }),
    ...(d.completedAt === undefined ? {} : { completedAt: number(d.completedAt) }),
    ...(d.collection === undefined ? {} : { collection: text(d.collection, 500) }),
    ...(d.origin === undefined ? {} : { origin: d.origin }),
    ...(d.notebookKind === undefined ? {} : { notebookKind: d.notebookKind }),
    activity,
    savedPassages: list(d.savedPassages ?? [], 20_000).map(note),
    reviewResponses: responses,
  };
}
function reject_unsafe_keys(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) fail();
    reject_unsafe_keys(child);
  }
}
export function parse_library_backup(raw: string): LibraryBackup {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error("Backup limit is 25 MB.");
  let value: any;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail();
  }
  // Bound recursion before descending into data supplied by another application.
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  while (pending.length) {
    const next = pending.pop()!;
    if (next.depth > 20) return fail();
    if (next.value && typeof next.value === "object")
      for (const child of Object.values(next.value)) pending.push({ value: child, depth: next.depth + 1 });
  }
  reject_unsafe_keys(value);
  const b = object(value);
  if (b.format !== "votic-library" || b.version !== 1 || !/^[a-zA-Z0-9-]{1,80}$/.test(b.id)) return fail();
  const documents = list(b.documents, MAX_LIBRARY_DOCUMENTS).map(document);
  if (new Set(documents.map((d) => d.id)).size !== documents.length) return fail();
  for (const d of documents)
    if (new Set(d.savedPassages?.map((n) => n.id)).size !== d.savedPassages?.length) return fail();
  const a = object(b.activity);
  number(a.trackingStartedAt);
  for (const [key, hour] of Object.entries(object(a.buckets))) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(key)) return fail();
    for (const split of Object.values(object(hour))) {
      const s = object(split);
      number(s.reading);
      number(s.listening);
    }
  }
  for (const event of list(a.ask, 5000)) {
    number(event.at);
    text(event.category, 100);
  }
  const activity = parse_log(JSON.stringify(a));
  if (!activity) return fail();
  activity.ask = activity.ask.map((event) => ({
    at: event.at,
    category: event.category,
    newConversation: Boolean(event.newConversation),
    ...(event.prompt === undefined ? {} : { prompt: text(event.prompt, 1000) }),
  }));
  const preferences = b.preferences === null ? null : object(b.preferences);
  if (
    preferences &&
    (!["adaptive", "quick", "simple", "detailed"].includes(preferences.explanationStyle) ||
      !["off", "word", "sentence", "both"].includes(preferences.highlightMode) ||
      typeof preferences.defaultPlaybackRate !== "number" ||
      preferences.defaultPlaybackRate < 0.5 ||
      preferences.defaultPlaybackRate > 3 ||
      !Number.isFinite(preferences.defaultPlaybackRate))
  )
    return fail();
  return {
    format: "votic-library",
    version: 1,
    id: b.id,
    createdAt: number(b.createdAt),
    documents,
    collections: list(b.collections, MAX_LIBRARY_COLLECTIONS).map((c) => text(c, 500, false)),
    activity,
    pronunciations: list(b.pronunciations, 250).map((p) => ({
      id: text(p.id, 200, false),
      term: text(p.term, 120, false),
      pronunciation: text(p.pronunciation, 180, false),
    })),
    preferences: preferences
      ? ({
          explanationStyle: preferences.explanationStyle,
          highlightMode: preferences.highlightMode,
          defaultPlaybackRate: preferences.defaultPlaybackRate,
          // Purpose is optional; do not import arbitrary nested objects into account settings.
          ...(typeof preferences.purpose === "string" ? { purpose: text(preferences.purpose, 100) } : {}),
        } as SavedAccountPreferences)
      : null,
  };
}

/** Existing work wins; differing documents become stable copies. Reimporting is idempotent. */
export function merge_library_backup(current: LibraryBackup, incoming: LibraryBackup): LibraryBackup {
  const documents = [...current.documents];
  const ids = new Map(documents.map((d) => [d.id, d]));
  const remapped = new Map<string, string>();
  for (const [index, original] of incoming.documents.entries()) {
    let id = original.id;
    if (ids.has(id)) {
      if (JSON.stringify(ids.get(id)) === JSON.stringify(original)) {
        remapped.set(id, id);
        continue;
      }
      id = `restored-${incoming.id}-${index}`;
      if (ids.has(id)) {
        remapped.set(original.id, id);
        continue;
      }
    }
    remapped.set(original.id, id);
    const copy = { ...original, id };
    documents.push(copy);
    ids.set(id, copy);
  }
  const activity = JSON.parse(JSON.stringify(current.activity ?? empty_log())) as ActivityLog;
  activity.trackingStartedAt = Math.min(activity.trackingStartedAt, incoming.activity.trackingStartedAt);
  for (const [hour, entries] of Object.entries(incoming.activity.buckets)) {
    const target = (activity.buckets[hour] ??= {});
    for (const [id, split] of Object.entries(entries)) {
      // A conflict copy must not count the same document's historical listening twice.
      const key = current.documents.some((document) => document.id === id) ? id : (remapped.get(id) ?? id);
      const prior = target[key];
      target[key] = {
        reading: Math.max(prior?.reading ?? 0, split.reading),
        listening: Math.max(prior?.listening ?? 0, split.listening),
      };
    }
  }
  activity.ask = [
    ...new Map([...incoming.activity.ask, ...activity.ask].map((e) => [JSON.stringify(e), e])).values(),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(-5000);
  return {
    ...current,
    documents,
    activity,
    collections: [...new Set([...current.collections, ...incoming.collections])],
    pronunciations: [
      ...current.pronunciations,
      ...incoming.pronunciations.filter((p) => !current.pronunciations.some((c) => c.id === p.id)),
    ].slice(0, 250),
    preferences: current.preferences ?? incoming.preferences,
  };
}
