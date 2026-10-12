import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { loadThemePreferences, saveThemePreferences } from "../preferences/preferenceStorage";
import { matchAppIcon } from "./appIcon";
export type AccentName =
  "blue" | "purple" | "orange" | "red" | "teal" | "emerald" | "indigo" | "rose" | "amber";
export type AppearanceMode = "light" | "dark" | "system";
export type ReaderAppearanceMode = "light" | "dark" | "sepia";
export const accentColors: Record<AccentName, string> = {
  orange: "#B45309",
  blue: "#2563EB",
  purple: "#7C3AED",
  red: "#B91C1C",
  teal: "#0F766E",
  emerald: "#15803D",
  indigo: "#4338CA",
  rose: "#BE185D",
  amber: "#A16207",
};
function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}
/** Darkens a #RRGGBB color by `amount` (0–1). */
function shade(hex: string, amount: number) {
  const channel = (start: number) =>
    Math.round(parseInt(hex.slice(start, start + 2), 16) * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}
/** Lift text accents on navy while keeping filled buttons dark enough for white labels. */
function tint(hex: string, amount: number) {
  const channel = (start: number) =>
    Math.round(parseInt(hex.slice(start, start + 2), 16) * (1 - amount) + 255 * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}
/**
 * On sepia paper the standard accents fall just under 4.5:1 for small text, so Sepia uses a
 * slightly deeper step of the same accent (every accent then clears 5:1 on the page).
 */
const SEPIA_ACCENT_SHADE = 0.12;
const palettes = {
  light: {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceMuted: "#F5F5F4",
    text: "#292D32",
    mutedText: "#626262",
    border: "#E5E7EB",
  },
  dark: {
    background: "#292D32",
    surface: "#32373D",
    surfaceMuted: "#24282D",
    text: "#FAFAF9",
    mutedText: "#D1D5DB",
    border: "#4B5158",
  },
  sepia: {
    background: "#F4ECD8",
    surface: "#FBF5E6",
    surfaceMuted: "#EADFC6",
    text: "#5B4636",
    mutedText: "#735E4B",
    border: "#DCCFB2",
  },
} as const;
// Navigation has its own atmosphere; Reader keeps the paper palettes above.
const navigationPalettes = {
  light: {
    background: "#F3F6FC",
    surface: "#FFFFFF",
    surfaceMuted: "#EAF0FA",
    text: "#17253D",
    mutedText: "#53637B",
    border: "#D6E0EF",
  },
  dark: {
    background: "#0B1220",
    surface: "#152238",
    surfaceMuted: "#1C2D47",
    text: "#F2F6FF",
    mutedText: "#B4C3DA",
    border: "#314461",
  },
};
function makeTheme(accentName: AccentName, resolvedMode: ReaderAppearanceMode, reader = false) {
  const accent =
    resolvedMode === "sepia" ? shade(accentColors[accentName], SEPIA_ACCENT_SHADE) : accentColors[accentName];
  return {
    ...(reader || resolvedMode === "sepia" ? palettes[resolvedMode] : navigationPalettes[resolvedMode]),
    // On dark backgrounds (the Reader's included) accent-colored text is lifted, or selected labels get hard to read.
    accentText:
      resolvedMode === "dark" ? tint(accent, reader ? 0.5 : 0.65) : reader ? accent : shade(accent, 0.12),
    /** Small accent-colored text, such as links, that stays readable on dark backgrounds too. */
    linkText: resolvedMode === "dark" ? tint(accent, 0.45) : accent,
    onAccent: "#FFFFFF",
    aiStatusText: resolvedMode === "dark" ? "#C4A7EA" : resolvedMode === "sepia" ? "#704795" : "#7653A6",
    brandTint: resolvedMode === "dark" ? "#1B3458" : "#E5EEFF",
    hero: resolvedMode === "dark" ? "#102B52" : "#DCE9FF",
    heroText: resolvedMode === "dark" ? "#F2F6FF" : "#142F58",
    heroMuted: resolvedMode === "dark" ? "#C0D4F2" : "#405C83",
    elevation: reader
      ? {}
      : {
          shadowColor: "#071A38",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: resolvedMode === "dark" ? 0.2 : 0.06,
          shadowRadius: 12,
          elevation: 2,
        },
    accent,
    logoWing: accent,
    playButton: accent,
    playIcon: "#FFFFFF",
    sentenceHighlight: withAlpha(accent, resolvedMode === "dark" ? "33" : "1F"),
    wordHighlight: withAlpha(accent, resolvedMode === "dark" ? "80" : "55"),
    mode: resolvedMode,
    isDark: resolvedMode === "dark",
  };
}
const C = createContext<any>(null);
/** Votic's color unless the person picks another one in Settings. */
export const DEFAULT_ACCENT: AccentName = "blue";
export function ThemeProvider({ children }: PropsWithChildren) {
  const [accentName, setAccentName] = useState<AccentName>(DEFAULT_ACCENT);
  // Whether the accent was picked in Settings, as opposed to saved automatically as the default.
  const [accentChosen, setAccentChosen] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>("light");
  const systemMode = useColorScheme();
  const [readerAppearanceMode, setReaderAppearanceMode] = useState<ReaderAppearanceMode | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    loadThemePreferences().then((saved) => {
      // Earlier versions saved their orange default without anyone choosing it. Only a color that was
      // actually picked in Settings (or any color other than that old default) is kept.
      const chosen = saved?.accentChosen === true || (saved?.accentName && saved.accentName !== "orange");
      if (chosen && saved.accentName in accentColors) {
        setAccentName(saved.accentName);
        setAccentChosen(true);
      }
      if (["light", "dark", "system"].includes(saved?.appearanceMode))
        setAppearanceMode(saved.appearanceMode);
      // Move legacy app-wide Sepia into the Reader without losing the saved choice.
      if (["light", "dark", "sepia"].includes(saved?.readerAppearanceMode)) {
        setReaderAppearanceMode(saved.readerAppearanceMode);
      } else if (saved?.appearanceMode === "sepia") {
        setReaderAppearanceMode("sepia");
      }
      setHydrated(true);
    });
  }, []);
  // Keeps the home-screen icon matched after updating from a version without colored icons. Does nothing
  // when it already matches, so it only ever changes once.
  useEffect(() => {
    if (hydrated) matchAppIcon(accentName);
  }, [hydrated, accentName]);
  useEffect(() => {
    if (hydrated)
      saveThemePreferences({ accentName, accentChosen, appearanceMode, readerAppearanceMode }).catch(
        () => {},
      );
  }, [accentName, accentChosen, appearanceMode, readerAppearanceMode, hydrated]);
  function chooseAccent(value: AccentName) {
    setAccentName(value);
    setAccentChosen(true);
  }
  const resolvedMode =
    appearanceMode === "system" ? (systemMode === "dark" ? "dark" : "light") : appearanceMode;
  const theme = useMemo(() => makeTheme(accentName, resolvedMode), [accentName, resolvedMode]);
  return (
    <C.Provider
      value={{
        accentName,
        setAccentName: chooseAccent,
        appearanceMode,
        setAppearanceMode,
        resolvedMode,
        theme,
        readerAppearanceMode,
        setReaderAppearanceMode,
      }}
    >
      {children}
    </C.Provider>
  );
}
/** The lighter orange used on the setup screens (Welcome through "Votic is ready for you"). */
export const SETUP_ACCENT = "#E8833A";
/** Ink for text on SETUP_ACCENT fills: 5.1:1, where white would be 2.7:1. */
const SETUP_ON_ACCENT = "#292D32";

/**
 * Gives the setup screens a lighter orange while the rest of Votic keeps the chosen accent. Fills (buttons,
 * progress, selections) use the lighter orange with dark text; links and small text keep the deeper accent
 * so they stay readable. With `active` false it changes nothing, so the tree stays the same either way.
 */
export function SetupAccent({ active, children }: PropsWithChildren<{ active: boolean }>) {
  const parent = useVoticTheme();
  const value = useMemo(() => {
    if (!active || parent.accentName !== "orange") return parent;
    const dark = parent.theme.isDark;
    return {
      ...parent,
      theme: {
        ...parent.theme,
        accent: SETUP_ACCENT,
        accentText: dark ? SETUP_ACCENT : parent.theme.accent,
        onAccent: SETUP_ON_ACCENT,
        playButton: SETUP_ACCENT,
        playIcon: SETUP_ON_ACCENT,
        sentenceHighlight: withAlpha(SETUP_ACCENT, dark ? "33" : "24"),
        wordHighlight: withAlpha(SETUP_ACCENT, dark ? "80" : "66"),
      },
    };
  }, [active, parent]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useVoticTheme() {
  const c = useContext(C);
  if (!c) throw new Error("useVoticTheme must be used inside ThemeProvider");
  return c;
}

/** Scope the document palette and its controls to the Reader route. */
export function ReaderThemeProvider({ children }: PropsWithChildren) {
  const app = useVoticTheme();
  const resolvedMode = app.readerAppearanceMode ?? app.resolvedMode;
  const theme = useMemo(() => makeTheme(app.accentName, resolvedMode, true), [app.accentName, resolvedMode]);
  return (
    <C.Provider
      value={{
        ...app,
        theme,
        resolvedMode,
        appearanceMode: resolvedMode,
        setAppearanceMode: app.setReaderAppearanceMode,
      }}
    >
      {children}
    </C.Provider>
  );
}
