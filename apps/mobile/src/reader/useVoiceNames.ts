import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useRef } from "react";
import { VoiceGender } from "./voices";

export const VOICE_NAMES_KEY = "votic.mobile.voice-names.v1";
export function parseVoiceNames(raw: string | null): Record<string, VoiceGender> {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(([, gender]) => gender === "female" || gender === "male"),
    ) as Record<string, VoiceGender>;
  } catch {
    return {};
  }
}
export function useVoiceNames() {
  const [genders, setGenders] = useState<Record<string, VoiceGender>>({});
  const [ready, setReady] = useState(false);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(VOICE_NAMES_KEY)
      .then((raw) => {
        if (mounted) setGenders(parseVoiceNames(raw));
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);
  async function setGender(identifier: string, gender: VoiceGender) {
    if (!ready || saving.current) return;
    saving.current = true;
    setBusy(true);
    const next = { ...genders, [identifier]: gender };
    try {
      await AsyncStorage.setItem(VOICE_NAMES_KEY, JSON.stringify(next));
      setGenders(next);
      setError(false);
    } catch {
      setError(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return { genders, ready: ready && !busy, error, setGender };
}
