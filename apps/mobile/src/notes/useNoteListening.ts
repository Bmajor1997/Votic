import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { splitPassages } from "../documents/passages";
import { normalizePlaybackRate } from "../playback/rates";
import { applyPronunciations, loadPronunciations } from "../reader/pronunciationDictionary";

/** A note owns audio only while its workspace is open; it never changes document progress. */
export function useNoteListening(text: string, playbackRate: number) {
  const { voiceIdentifier } = useAccessibilityPreferences();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const session = useRef(0);
  const ownsAudio = useRef(false);

  function stop() {
    session.current += 1;
    setPlaying(false);
    if (ownsAudio.current) {
      ownsAudio.current = false;
      void Speech.stop().catch(() => {});
    }
  }
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => {
      subscription.remove();
      session.current += 1;
      if (ownsAudio.current) void Speech.stop().catch(() => {});
    };
  }, []);

  async function toggle() {
    if (playing) return stop();
    const token = ++session.current;
    const current = () => token === session.current;
    setError("");
    setPlaying(true);
    ownsAudio.current = true;
    try {
      await Speech.stop();
      const pronunciations = await loadPronunciations();
      if (!current()) return;
      // Use Reader passage splitting; bound utterances for native engine length limits.
      const chunks = splitPassages(text).flatMap((passage) => {
        const spoken = applyPronunciations(passage, pronunciations);
        const limit = Math.max(1, Math.min(3000, Speech.maxSpeechInputLength || 3000));
        return spoken.match(new RegExp(`[\\s\\S]{1,${limit}}`, "g")) || [];
      });
      function speak(index: number) {
        if (!current()) return;
        if (!chunks[index]) {
          ownsAudio.current = false;
          setPlaying(false);
          return;
        }
        Speech.speak(chunks[index], {
          voice: voiceIdentifier || undefined,
          rate: normalizePlaybackRate(playbackRate),
          onDone: () => speak(index + 1),
          onStopped: () => {
            if (current()) {
              ownsAudio.current = false;
              setPlaying(false);
            }
          },
          onError: () => {
            if (current()) {
              ownsAudio.current = false;
              setPlaying(false);
              setError("Couldn’t read this note aloud. Please try again.");
            }
          },
        });
      }
      speak(0);
    } catch {
      if (current()) {
        ownsAudio.current = false;
        setPlaying(false);
        setError("Couldn’t start listening. Please try again.");
      }
    }
  }
  return { playing, error, toggle };
}
