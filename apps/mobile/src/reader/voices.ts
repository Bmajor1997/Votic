/** The fields Votic uses from a device voice (expo-speech's Voice has more). */
export type DeviceVoice = { identifier: string; name: string; language: string };
export type VoiceGender = "female" | "male";
const NAMES = {
  female: ["Mira", "Kaia", "Nyla", "Elara", "Clara", "Sofia", "Emma", "Lily"],
  male: ["Daniel", "Soren", "Kellan", "Oliver", "James", "Noah", "Henry", "Leo"],
  // Most Android voices don't say whether they sound female or male, so they get names that suit either.
  either: [
    "Alex",
    "Jordan",
    "Rowan",
    "Quinn",
    "Avery",
    "Riley",
    "Morgan",
    "Casey",
    "Jamie",
    "Taylor",
    "Reese",
    "Sage",
    "Emerson",
    "Harper",
    "Logan",
    "Skyler",
  ],
};

/** Only explicit engine metadata is trusted; opaque Android voice codes do not encode reliable gender. */
export function device_voice_gender(voice: DeviceVoice): VoiceGender | undefined {
  const markers = `${voice.name} ${voice.identifier}`.toLowerCase().split(/[^a-z]+/);
  if (markers.includes("female")) return "female";
  if (markers.includes("male")) return "male";
  return undefined;
}

function identity_hash(identifier: string) {
  return Array.from(identifier).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
}

/**
 * A friendly name for every voice, never a device code, and no two alike. Names come from each voice's identity,
 * rather than the OS's list order, so the same voice keeps its name across launches.
 */
export function votic_voice_names(voices: DeviceVoice[]): Record<string, string> {
  const names: Record<string, string> = {};
  const used = new Set<string>();
  const ordered = [...voices].sort((a, b) => (a.identifier < b.identifier ? -1 : 1));
  ordered.forEach((voice, index) => {
    const list = NAMES[device_voice_gender(voice) ?? "either"];
    const first = identity_hash(voice.identifier) % list.length;
    // On a clash, take the next free name in the same list.
    const free = list.map((_, step) => list[(first + step) % list.length]).find((name) => !used.has(name));
    const name = free ?? `Voice ${index + 1}`;
    used.add(name);
    names[voice.identifier] = name;
  });
  return names;
}

export function votic_voice_preview(name: string) {
  return `Hi, I'm ${name}. I'm here to make reading feel clear, comfortable, and easy to follow.`;
}

/** Keep one English voice per display name so platform variants do not create duplicate choices. */
export function unique_english_voices<T extends DeviceVoice>(available: T[]) {
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
