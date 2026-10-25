import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import { unique_english_voices, votic_voice_names, type DeviceVoice } from "../reader/voices";

/** The device's English voices, one per sound, with the friendly names Votic shows everywhere. */
export function useDeviceVoices() {
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
  return { voices: voices ?? [], loaded: voices !== null, names };
}

/** The name of the voice in use: the chosen one, or "Device voice" when none is chosen or it's unavailable. */
export function current_voice_name(names: Record<string, string>, selected: string | null) {
  return (selected && names[selected]) || "Device voice";
}
