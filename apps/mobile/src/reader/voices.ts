/** The fields Votic uses from a device voice (expo-speech's Voice has more). */
export type DeviceVoice = { identifier: string; name: string; language: string };

const VOTIC_VOICE_NAMES = ["Arden", "Kaia", "Soren", "Mira", "Evren", "Nyla", "Kellan", "Elara"] as const;
const VOTIC_VOICE_PREVIEWS = [
  "Hi, I'm Arden. I'm here to make reading feel clear, comfortable, and easy to follow.",
  "Hi, I'm Kaia. Choose me when you want a bright, expressive voice to read alongside you.",
  "Hi, I'm Soren. I'll help you settle in, focus on the words, and move through your reading at your pace.",
  "Hi, I'm Mira. I'm here to make listening feel calm, natural, and comfortable.",
  "Hi, I'm Evren. I'll keep your reading clear and steady, whether you're studying or simply listening.",
  "Hi, I'm Nyla. I'm here to make your documents feel a little more conversational and easy to enjoy.",
  "Hi, I'm Kellan. Choose me for a relaxed, grounded reading experience that stays out of your way.",
  "Hi, I'm Elara. I'll bring a gentle, polished voice to whatever you choose to read.",
] as const;

export function voticVoiceName(index: number) {
  return VOTIC_VOICE_NAMES[index] ?? `Voice ${index + 1}`;
}

export function voticVoicePreview(index: number) {
  return (
    VOTIC_VOICE_PREVIEWS[index] ??
    `Hi, I'm Voice ${index + 1}. Here's a quick preview of how I'll sound while reading with you.`
  );
}

/** English device voices, one per name, up to the number of Votic voice names. */
export function uniqueEnglishVoices<T extends DeviceVoice>(available: T[]) {
  const seen = new Set<string>();
  return available
    .filter((voice) => voice.language.toLowerCase().startsWith("en"))
    .filter((voice) => {
      const key = (voice.name.trim() || voice.identifier).toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, VOTIC_VOICE_NAMES.length);
}
