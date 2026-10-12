import { account_storage_key } from "../storage/accountStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FLOWS, FlowId } from "./walkthroughFlows";

export const WALKTHROUGH_KEY = "votic.mobile.walkthrough.v1";
const DEVICE_HISTORY_KEY = "votic.mobile.device-history.v1";
const ONBOARDING_KEY = "votic.mobile.onboarding.v2";
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

export function parse_walkthrough_state(raw: string | null): WalkthroughState | null {
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
export function migrated_flows(input: {
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

function parse_list(raw: string | null): unknown[] {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parse_object(raw: string | null): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

/** Walkthrough progress belongs to the signed-in account, so each account on a device keeps its own. */
export function walkthrough_key(uid: string) {
  return `${WALKTHROUGH_KEY}:${uid}`;
}

/** Facts about the signed-in account, read when its walkthrough progress is first created on this device. */
export type WalkthroughAccount = { uid: string; isNewAccount: boolean; sessionRestored: boolean };

/**
 * Loads this account's walkthrough progress. When none is saved on this device yet: a new account starts
 * fresh; an account that already existed (another device, a reinstall) has been through Votic already, so
 * nothing shows on its own (every section can still be replayed from Settings); and a session from before
 * progress was kept per account takes over what this device had recorded.
 */
export async function load_walkthrough_state(
  account: WalkthroughAccount,
  now = Date.now(),
): Promise<WalkthroughState> {
  const saved = parse_walkthrough_state(await AsyncStorage.getItem(walkthrough_key(account.uid)));
  if (saved) return saved;
  const state = account.sessionRestored
    ? await load_device_state(now, account.uid)
    : account.isNewAccount
      ? EMPTY_WALKTHROUGH
      : {
          version: 1 as const,
          flows: Object.fromEntries(
            Object.keys(FLOWS).map((id) => [id, { status: "migrated" as const, at: now }]),
          ),
        };
  await save_walkthrough_state(account.uid, state);
  return state;
}

/** Progress recorded for the whole device, before it was kept per account; decides what existing users know. */
async function load_device_state(now: number, uid: string): Promise<WalkthroughState> {
  const saved = parse_walkthrough_state(await AsyncStorage.getItem(WALKTHROUGH_KEY));
  if (saved) {
    // Progress saved before the welcome card existed means this person is already past it.
    if (saved.flows.intro || !Object.keys(saved.flows).length) return saved;
    return { ...saved, flows: { ...saved.flows, intro: { status: "migrated", at: now } } };
  }
  const [
    [, history],
    [, onboarding],
    [, accountLibrary],
    [, accountCollections],
    [, oldLibrary],
    [, oldCollections],
  ] = await AsyncStorage.multiGet([
    DEVICE_HISTORY_KEY,
    ONBOARDING_KEY,
    account_storage_key(LIBRARY_KEY, uid),
    account_storage_key(COLLECTIONS_KEY, uid),
    LIBRARY_KEY,
    COLLECTIONS_KEY,
  ]);
  // This person's library from before it was kept per account counts too, so tours they've already learned
  // don't play again even if it hasn't been moved into their account yet.
  const library = accountLibrary ?? oldLibrary;
  const collections = accountCollections ?? oldCollections;
  // Devices that ran a build from before the device history was recorded had already finished setup.
  const finishedSetupBefore = history === null && parse_object(onboarding)?.personalized === true;
  const learned = migrated_flows({
    existingDevice: history === "existing" || finishedSetupBefore,
    documents: parse_list(library) as StoredDocumentLike[],
    collections: parse_list(collections).filter((item): item is string => typeof item === "string"),
  });
  return {
    version: 1,
    flows: Object.fromEntries(learned.map((id) => [id, { status: "migrated" as const, at: now }])),
  };
}

export async function save_walkthrough_state(uid: string, state: WalkthroughState) {
  await AsyncStorage.setItem(walkthrough_key(uid), JSON.stringify(state));
}

export async function remove_walkthrough_state(uid: string) {
  await AsyncStorage.removeItem(walkthrough_key(uid));
}
