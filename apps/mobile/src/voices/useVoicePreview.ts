import { useFocusEffect } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { notification_player } from "../playback/notificationPlayback";
import { votic_voice_preview, type DeviceVoice } from "../reader/voices";

/**
 * Plays a short voice sample outside the Reader. A document listening in the background is paused through its own
 * player first (its place is kept), and leaving the screen or the app always stops the sample.
 */
export function useVoicePreview() {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const session = useRef(0);
  const stop = useCallback(() => {
    session.current += 1;
    setPreviewing(null);
    void Speech.stop().catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => stop, [stop]));
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => listener.remove();
  }, [stop]);
  async function toggle(voice: DeviceVoice, name: string) {
    if (previewing === voice.identifier) {
      stop();
      return;
    }
    const token = ++session.current;
    setPreviewing(voice.identifier);
    const done = () => {
      if (token === session.current) setPreviewing(null);
    };
    try {
      await notification_player()
        ?.pause()
        .catch(() => {});
      await Speech.stop();
      if (token !== session.current) return;
      Speech.speak(votic_voice_preview(name), {
        voice: voice.identifier,
        rate: 1,
        onDone: done,
        onStopped: done,
        onError: done,
      });
    } catch {
      done();
    }
  }
  return { previewing, toggle, stop };
}
