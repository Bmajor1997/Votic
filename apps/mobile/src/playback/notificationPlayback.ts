import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { apply_pronunciations, type PronunciationEntry } from "../reader/pronunciationDictionary";
import { word_matches } from "../reader/readerText";
import { normalize_playback_rate } from "./rates";

export type NotificationPlaybackState = {
  accountId: string;
  documentId: string;
  title: string;
  passageIndex: number;
  wordIndex: number;
  playing: boolean;
  completed: boolean;
  error: string | null;
};

export type NotificationPlayback = {
  start: (payload: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  get_state: () => Partial<NotificationPlaybackState>;
  addListener: (
    event: "state",
    callback: (state: Partial<NotificationPlaybackState>) => void,
  ) => { remove: () => void };
};

/** Web, iPhone, and Expo Go keep the existing screen-based speech implementation. */
export function notification_player(): NotificationPlayback | null {
  if (Platform.OS !== "android") return null;
  try {
    return requireOptionalNativeModule<NotificationPlayback>("VoticPlayback");
  } catch {
    return null;
  }
}

/** Keeps native boundaries aligned with the original text, including custom pronunciations. */
export function notification_passages(passages: string[], pronunciations: PronunciationEntry[]) {
  return passages.map((source) => {
    const text = apply_pronunciations(source, pronunciations);
    const matches = word_matches(text);
    const sourceCount = word_matches(source).length;
    return {
      text,
      offsets: matches.map((word) => word.index ?? 0),
      words: matches.map((_word, index) =>
        source === text
          ? index
          : Math.min(
              sourceCount - 1,
              Math.round((index / Math.max(1, matches.length - 1)) * Math.max(0, sourceCount - 1)),
            ),
      ),
    };
  });
}

export function notification_payload(
  accountId: string,
  document: { id: string; title: string },
  passages: string[],
  pronunciations: PronunciationEntry[],
  passageIndex: number,
  wordIndex: number,
  rate: number,
  voice?: string | null,
) {
  return JSON.stringify({
    accountId,
    documentId: document.id,
    title: document.title,
    passages: notification_passages(passages, pronunciations),
    passageIndex,
    wordIndex,
    rate: normalize_playback_rate(rate),
    ...(voice ? { voice } : {}),
  });
}

export function valid_playback_state(
  state: Partial<NotificationPlaybackState>,
  accountId: string | null,
): state is NotificationPlaybackState {
  return Boolean(
    accountId &&
    state.accountId === accountId &&
    state.documentId &&
    Number.isInteger(state.passageIndex) &&
    Number.isInteger(state.wordIndex) &&
    (state.passageIndex ?? -1) >= 0 &&
    (state.wordIndex ?? -1) >= 0 &&
    typeof state.playing === "boolean" &&
    typeof state.completed === "boolean",
  );
}
