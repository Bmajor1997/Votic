/** The fields Votic uses from a device voice (expo-speech's Voice has more). */
export type DeviceVoice = {
  identifier: string;
  name: string;
  language: string;
  /** "Enhanced" when the phone reports a high-quality voice (expo-speech's VoiceQuality). */
  quality?: string;
};
export type VoiceGender = "female" | "male";
const NAMES = {
  female: ["Mira", "Kaia", "Nyla", "Elara", "Clara", "Sofia", "Emma", "Lily"],
  male: ["Daniel", "Soren", "Kellan", "Oliver", "James", "Noah", "Henry", "Leo"],
  // Most Android voices don't say whether they sound female or male, so they get names that suit either.
  // There can be dozens of English voices (several accents), so there are enough names for every one.
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
    "Parker",
    "Hayden",
    "Dakota",
    "Ellis",
    "Finley",
    "Marlowe",
    "Remy",
    "Shiloh",
    "Sasha",
    "Robin",
    "Jules",
    "Arden",
    "Blair",
    "Cameron",
    "Drew",
    "Eden",
    "Frankie",
    "Gray",
    "Hollis",
    "Indigo",
    "Jesse",
    "Kai",
    "Lane",
    "Micah",
    "Nico",
    "Oakley",
    "Peyton",
    "Rory",
    "Sutton",
    "Tatum",
    "Wren",
    "Ari",
    "Bailey",
    "Charlie",
    "Devon",
    "Emery",
    "Flynn",
    "Hunter",
    "Jaden",
    "Kendall",
    "Lennox",
    "Monroe",
    "Noel",
    "Phoenix",
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

/**
 * One English voice per sound. Android lists most voices twice, an offline copy ("…-local") and an online copy
 * ("…-network") that sound the same, so only one is kept, preferring the offline copy that works without internet.
 */
export function unique_english_voices<T extends DeviceVoice>(available: T[]) {
  const sound = (voice: T) =>
    voice.name
      .trim()
      .toLocaleLowerCase()
      .replace(/-(?:local|network)$/, "");
  const english = available.filter((voice) => voice.language.toLowerCase().startsWith("en"));
  const offline_first = [...english].sort(
    (a, b) => Number(/-network$/i.test(a.name)) - Number(/-network$/i.test(b.name)),
  );
  const kept = new Set<T>();
  const seen = new Set<string>();
  for (const voice of offline_first) {
    if (seen.has(sound(voice))) continue;
    seen.add(sound(voice));
    kept.add(voice);
  }
  // Keep the device's own order for the voices that remain.
  return english.filter((voice) => kept.has(voice));
}

/** The most voices offered for one accent (US, British, Australian…); more than this mostly sound alike. */
export const VOICES_PER_ACCENT = 3;

/**
 * A short, varied list from the device's unique English voices: at most three per accent, skipping each accent's
 * generic "…-language" default (it repeats one of that accent's named voices). High-quality voices come first.
 * The voice someone already chose always stays, so nobody loses the voice they picked.
 */
export function voice_shortlist<T extends DeviceVoice>(voices: T[], keep: string | null = null) {
  const accent = (voice: T) => voice.language.toLowerCase().replace("_", "-");
  const generic = (voice: T) => /-language$/i.test(voice.identifier) || /-language$/i.test(voice.name);
  const named = new Set(voices.filter((voice) => !generic(voice)).map(accent));
  const candidates = voices.filter(
    (voice) => voice.identifier === keep || !generic(voice) || !named.has(accent(voice)),
  );
  const ranked = [...candidates].sort(
    (a, b) =>
      Number(b.identifier === keep) - Number(a.identifier === keep) ||
      Number(b.quality === "Enhanced") - Number(a.quality === "Enhanced") ||
      (a.identifier < b.identifier ? -1 : a.identifier > b.identifier ? 1 : 0),
  );
  const counts = new Map<string, number>();
  const kept = new Set<T>();
  for (const voice of ranked) {
    const count = counts.get(accent(voice)) ?? 0;
    if (count >= VOICES_PER_ACCENT && voice.identifier !== keep) continue;
    counts.set(accent(voice), count + 1);
    kept.add(voice);
  }
  // Keep the device's own order for the voices that remain.
  return voices.filter((voice) => kept.has(voice));
}
