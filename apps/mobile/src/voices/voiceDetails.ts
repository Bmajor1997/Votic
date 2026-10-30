import type { DeviceVoice } from "../reader/voices";

const ACCENTS: Record<string, string> = {
  us: "US English",
  gb: "British English",
  au: "Australian English",
  in: "Indian English",
  ie: "Irish English",
  ca: "Canadian English",
  nz: "New Zealand English",
  za: "South African English",
  ng: "Nigerian English",
  sg: "Singaporean English",
};

/** The accent a voice speaks with, from its language tag ("en-GB" → "British English"). */
export function voice_accent(voice: Pick<DeviceVoice, "language">) {
  const region = voice.language.split(/[-_]/)[1]?.toLowerCase() ?? "";
  return ACCENTS[region] ?? "English";
}

/** A short description read with each voice: its accent, and whether it needs an internet connection. */
export function voice_detail(voice: DeviceVoice) {
  const online = /-network$/i.test(voice.name) || /-network$/i.test(voice.identifier);
  return online ? `${voice_accent(voice)} · Needs internet` : voice_accent(voice);
}

/** The selected voice first, then the rest in the device's order, limited to `count` choices. */
export function featured_voices<T extends DeviceVoice>(voices: T[], selected: string | null, count: number) {
  const chosen = voices.find((voice) => voice.identifier === selected);
  return (chosen ? [chosen, ...voices.filter((voice) => voice !== chosen)] : voices).slice(0, count);
}

/** Whether the phone reports this voice as high quality (iOS "Enhanced"/Premium, Android above normal quality). */
export function is_high_quality(voice: Pick<DeviceVoice, "quality">) {
  return voice.quality === "Enhanced";
}
