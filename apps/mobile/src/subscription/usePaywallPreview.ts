import { useFocusEffect } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { notification_player } from "../playback/notificationPlayback";
import { unique_english_voices, votic_voice_names, type DeviceVoice } from "../reader/voices";
import { preview_word_at, preview_words } from "./paywallPresentation";

/**
 * Owns only this preview's audio. Late callbacks cannot restart it after blur, checkout or unmount.
 * `text` is what gets read: the sample page, or words the visitor typed, which never leave the device.
 */
export function usePaywallPreview(disabled: boolean, text: string) {
  const { voiceIdentifier, setVoiceIdentifier } = useAccessibilityPreferences();
  // The list is ordered once, so choosing (and saving) a voice doesn't reshuffle the choices under the finger.
  const initialVoice = useRef(voiceIdentifier);
  const [voices, setVoices] = useState<DeviceVoice[]>([]);
  const [voice, setVoice] = useState<string | null>(voiceIdentifier);
  const { defaultPlaybackRate, setDefaultPlaybackRate } = useVoticPurpose();
  const rate = defaultPlaybackRate;
  const [playing, setPlaying] = useState(false);
  const [word, setWord] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const session = useRef(0);
  const ownsAudio = useRef(false);
  const focused = useRef(false);
  const blocked = useRef(disabled);
  const words = useMemo(() => preview_words(text), [text]);

  const cancel = useCallback(() => {
    session.current += 1;
    if (ownsAudio.current) void Speech.stop().catch(() => {});
    ownsAudio.current = false;
  }, []);
  const stop = useCallback(() => {
    cancel();
    setPlaying(false);
    setWord(-1);
  }, [cancel]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setPlaying(false);
      setWord(-1);
      return () => {
        focused.current = false;
        cancel();
      };
    }, [cancel]),
  );

  useEffect(() => {
    let current = true;
    void Promise.resolve(Speech.getAvailableVoicesAsync())
      .then((available) => {
        if (!current) return;
        const english = unique_english_voices(available);
        const preferred = english.find((item) => item.identifier === initialVoice.current);
        const choices = preferred ? [preferred, ...english.filter((item) => item !== preferred)] : english;
        setVoices(choices.slice(0, 3));
        setVoice(preferred?.identifier ?? choices[0]?.identifier ?? null);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    blocked.current = disabled;
    // Synchronize the external speech engine when a store sheet takes over.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (disabled) stop();
  }, [disabled, stop]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => listener.remove();
  }, [stop]);

  async function play() {
    if (blocked.current || !focused.current || !text.trim()) return;
    const spoken = { text, words };
    const token = ++session.current;
    ownsAudio.current = true;
    setError(null);
    setPlaying(true);
    setWord(-1);
    const current = () => token === session.current && focused.current && !blocked.current;
    const done = () => {
      if (!current()) return;
      ownsAudio.current = false;
      setPlaying(false);
      setWord(-1);
    };
    const failed = () => {
      if (!current()) return;
      done();
      setError("The voice preview couldn't play. Check your device's speech settings and try again.");
    };
    try {
      // The device has one speech engine. A document still reading in the background is stopped through its
      // own player, so its controls and saved place stay correct, instead of being cut off underneath it.
      await notification_player()
        ?.stop()
        .catch(() => {});
      await Speech.stop();
      if (!current()) return;
      Speech.speak(spoken.text, {
        language: "en-US",
        voice: voice ?? undefined,
        rate,
        onBoundary: (event: { charIndex: number }) => {
          if (current()) setWord(preview_word_at(spoken.words, event.charIndex));
        },
        onDone: done,
        onStopped: done,
        onError: failed,
      });
    } catch {
      failed();
    }
  }

  /** The voice tried here becomes the reading voice, so it is the one heard after subscribing. */
  function chooseVoice(identifier: string) {
    stop();
    setVoice(identifier);
    setVoiceIdentifier(identifier);
  }
  function chooseRate(value: number) {
    stop();
    setDefaultPlaybackRate(value);
  }
  // Editing or switching the text ends the old reading; its word positions no longer match.
  useEffect(() => stop, [text, stop]);

  return {
    words,
    voices,
    names: votic_voice_names(voices),
    voice,
    rate,
    playing,
    word,
    error,
    play,
    stop,
    chooseVoice,
    chooseRate,
  };
}
