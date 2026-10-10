/** The fields Votic uses from a device voice (expo-speech's Voice has more). */
export type DeviceVoice = { identifier: string; name: string; language: string };
export type VoiceGender = "female" | "male";
const NAMES = {
  female: ["Mira", "Kaia", "Nyla", "Elara", "Clara", "Sofia", "Emma", "Lily"],
  male: ["Daniel", "Soren", "Kellan", "Oliver", "James", "Noah", "Henry", "Leo"],
};

/** Only explicit engine metadata is trusted; opaque Android voice codes do not encode reliable gender. */
export function deviceVoiceGender(voice: DeviceVoice): VoiceGender | undefined {
  const markers = `${voice.name} ${voice.identifier}`.toLowerCase().split(/[^a-z]+/);
  if (markers.includes("female")) return "female";
  if (markers.includes("male")) return "male";
  return undefined;
}

export function voticVoiceName(voice: DeviceVoice, gender?: VoiceGender, index = 0) {
  const resolved = gender ?? deviceVoiceGender(voice);
  if (!resolved) return `Device voice ${index + 1}`;
  // Identity, rather than the OS's list order, keeps the chosen name stable across reloads.
  const hash = Array.from(voice.identifier).reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    0,
  );
  return NAMES[resolved][hash % NAMES[resolved].length];
}

export function voticVoicePreview(name: string) {
  return `Hi, I'm ${name}. I'm here to make reading feel clear, comfortable, and easy to follow.`;
}

/** Keep one English voice per display name so platform variants do not create duplicate choices. */
export function uniqueEnglishVoices<T extends DeviceVoice>(available: T[]) {
  const seen = new Set<string>();
  return available
    .filter((voice) => voice.language.toLowerCase().startsWith("en"))
    .filter((voice) => {
      const key = voice.name.trim().toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
