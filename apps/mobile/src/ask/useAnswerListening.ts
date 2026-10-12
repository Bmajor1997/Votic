import * as Speech from "expo-speech";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { split_passages } from "../documents/passages";
import { normalize_playback_rate } from "../playback/rates";
import { apply_pronunciations, load_pronunciations } from "../reader/pronunciationDictionary";

/** One answer at a time, owned by the focused Ask screen; never changes document progress. */
export function useAnswerListening(contextKey: string, enabled = true, playbackRate = 1) {
  const { voiceIdentifier } = useAccessibilityPreferences();
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const session = useRef(0);
  const owner = useRef<string | null>(null);
  const focused = useRef(false);
  const active = useRef(enabled);

  const stop = useCallback(() => {
    session.current += 1;
    setPlayingKey(null);
    if (owner.current === null) return Promise.resolve();
    owner.current = null;
    return Speech.stop().catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        void stop();
      };
    }, [stop]),
  );
  useEffect(() => {
    active.current = enabled;
    const token = ++session.current;
    if (owner.current !== null) {
      owner.current = null;
      void Speech.stop().catch(() => {});
    }
    const frame = requestAnimationFrame(() => {
      if (token !== session.current) return;
      setPlayingKey(null);
      setErrorKey(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [contextKey, enabled]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") void stop();
    });
    return () => listener.remove();
  }, [stop]);

  async function toggle(key: string, text: string, beforeStart?: () => Promise<void>) {
    if (owner.current === key) return stop();
    const stopped = stop();
    if (!focused.current || !active.current || !text.trim()) return;
    const token = ++session.current;
    const current = () => token === session.current && focused.current && active.current;
    owner.current = key;
    setPlayingKey(key);
    setErrorKey(null);
    function finish(failed = false) {
      if (!current()) return;
      owner.current = null;
      setPlayingKey(null);
      if (failed) setErrorKey(key);
    }
    try {
      await stopped;
      if (!current()) return;
      await beforeStart?.();
      if (!current()) return;
      await Speech.stop();
      if (!current()) return;
      const pronunciations = await load_pronunciations();
      if (!current()) return;
      const limit = Math.max(1, Math.min(3000, Speech.maxSpeechInputLength || 3000));
      const chunks = split_passages(text).flatMap((passage) => {
        const spoken = apply_pronunciations(passage, pronunciations);
        return spoken.match(new RegExp(`[\\s\\S]{1,${limit}}`, "gu")) || [];
      });
      function speak(index: number) {
        if (!current()) return;
        if (!chunks[index]) return finish();
        Speech.speak(chunks[index], {
          voice: voiceIdentifier || undefined,
          rate: normalize_playback_rate(playbackRate),
          onDone: () => {
            try {
              speak(index + 1);
            } catch {
              finish(true);
            }
          },
          onStopped: () => finish(),
          onError: () => finish(true),
        });
      }
      speak(0);
    } catch {
      finish(true);
    }
  }
  return { playingKey, errorKey, toggle, stop };
}
