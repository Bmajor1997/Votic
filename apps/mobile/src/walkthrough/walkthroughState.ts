import AsyncStorage from "@react-native-async-storage/async-storage";
import { FLOWS, FlowId } from "./walkthroughFlows";

export const WALKTHROUGH_KEY = "votic.mobile.walkthrough.v1";
const DEVICE_HISTORY_KEY = "votic.mobile.device-history.v1";
const LIBRARY_KEY = "votic.mobile.library.v2";
const COLLECTIONS_KEY = "votic.mobile.collections.v1";

/**
 * How each walkthrough section or tip ended. Every flow is tracked on its own: skipping Home says
 * nothing about Documents, Notes, or the Reader.
 */
export type FlowStatus = "completed" | "skipped" | "migrated";
export type WalkthroughState = {
  version: 1;
  flows: Partial<Record<FlowId, { status: FlowStatus; at: number }>>;
};

export const EMPTY_WALKTHROUGH: WalkthroughState = { version: 1, flows: {} };

export function parseWalkthroughState(raw: string | null): WalkthroughState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const flows: WalkthroughState["flows"] = {};
    for (const [id, entry] of Object.entries(
      (value?.flows ?? {}) as Record<string, { status?: unknown; at?: unknown }>,
    )) {
      if (!(id in FLOWS) || !entry) continue;
      if (entry.status !== "completed" && entry.status !== "skipped" && entry.status !== "migrated") continue;
      flows[id as FlowId] = { status: entry.status, at: typeof entry.at === "number" ? entry.at : 0 };
    }
    return { version: 1, flows };
  } catch {
    return null;
  }
}

type StoredDocumentLike = {
  progress?: number;
  lastOpenedAt?: number;
  collection?: string;
  savedPassages?: { pinned?: boolean }[];
};

/**
 * For people who used Votic before the walkthrough existed: anything they've clearly used already is
 * treated as learned, so they only see walkthroughs for areas they haven't tried.
 */
export function migratedFlows(input: {
  existingDevice: boolean;
  documents: StoredDocumentLike[];
  collections: string[];
}) {
  const learned: FlowId[] = [];
  if (!input.existingDevice) return learned;
  const { documents } = input;
  const passages = documents.flatMap((document) => document.savedPassages || []);
  // The welcome card and the completion card are for people starting fresh with this version.
  learned.push("intro", "allSet", "home");
  if (documents.length) learned.push("documents", "home.documentOptions");
  if (input.collections.length || documents.some((document) => document.collection))
    learned.push("documents.collections");
  if (passages.length) learned.push("notes", "reader.saved");
  if (passages.some((passage) => passage.pinned)) learned.push("notes.pinned");
  if (documents.some((document) => document.lastOpenedAt || document.progress)) learned.push("reader");
  return learned;
}

function parseList(raw: string | null): unknown[] {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** Loads walkthrough progress; on the first launch with walkthroughs, decides what existing users already know. */
export async function loadWalkthroughState(now = Date.now()): Promise<WalkthroughState> {
  const saved = parseWalkthroughState(await AsyncStorage.getItem(WALKTHROUGH_KEY));
  if (saved) {
    // Progress saved before the welcome card existed means this person is already past it.
    if (saved.flows.intro || !Object.keys(saved.flows).length) return saved;
    const upgraded: WalkthroughState = {
      ...saved,
      flows: { ...saved.flows, intro: { status: "migrated", at: now } },
    };
    await saveWalkthroughState(upgraded);
    return upgraded;
  }
  const [[, history], [, library], [, collections]] = await AsyncStorage.multiGet([
    DEVICE_HISTORY_KEY,
    LIBRARY_KEY,
    COLLECTIONS_KEY,
  ]);
  const learned = migratedFlows({
    existingDevice: history === "existing",
    documents: parseList(library) as StoredDocumentLike[],
    collections: parseList(collections).filter((item): item is string => typeof item === "string"),
  });
  const state: WalkthroughState = {
    version: 1,
    flows: Object.fromEntries(learned.map((id) => [id, { status: "migrated" as const, at: now }])),
  };
  await saveWalkthroughState(state);
  return state;
}

export async function saveWalkthroughState(state: WalkthroughState) {
  await AsyncStorage.setItem(WALKTHROUGH_KEY, JSON.stringify(state));
}
