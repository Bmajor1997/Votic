import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import {
  unique_english_voices,
  voice_shortlist,
  votic_voice_names,
  type DeviceVoice,
} from "../reader/voices";

/**
 * A short list of the device's English voices (see voice_shortlist), with the friendly names Votic shows
 * everywhere. Names come from the full list, so trimming it never renames a voice.
 */
export function useDeviceVoices() {
  const { voiceIdentifier } = useAccessibilityPreferences();
  const [voices, setVoices] = useState<DeviceVoice[] | null>(null);
  useEffect(() => {
    let current = true;
    void Promise.resolve(Speech.getAvailableVoicesAsync())
      .then((available) => {
        if (current) setVoices(unique_english_voices(available ?? []));
      })
      .catch(() => {
        if (current) setVoices([]);
      });
    return () => {
      current = false;
    };
  }, []);
  const names = useMemo(() => votic_voice_names(voices ?? []), [voices]);
  const shortlist = useMemo(() => voice_shortlist(voices ?? [], voiceIdentifier), [voices, voiceIdentifier]);
  return { voices: shortlist, loaded: voices !== null, names };
}

/** The name of the voice in use: the chosen one, or "Device voice" when none is chosen or it's unavailable. */
export function current_voice_name(names: Record<string, string>, selected: string | null) {
  return (selected && names[selected]) || "Device voice";
}
