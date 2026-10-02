import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { loadThemePreferences, saveThemePreferences } from "../preferences/preferenceStorage";
export type AccentName =
  "blue" | "purple" | "orange" | "red" | "teal" | "emerald" | "indigo" | "rose" | "amber";
export type AppearanceMode = "light" | "dark" | "sepia";
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
const C = createContext<any>(null);
/** Votic's color unless the person picks another one in Settings. */
export const DEFAULT_ACCENT: AccentName = "blue";
export function ThemeProvider({ children }: PropsWithChildren) {
  const [accentName, setAccentName] = useState<AccentName>(DEFAULT_ACCENT);
  // Whether the accent was picked in Settings, as opposed to saved automatically as the default.
  const [accentChosen, setAccentChosen] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>("light");
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
      // A saved "system" choice from before Sepia replaced it falls back to the Light default.
      if (["light", "dark", "sepia"].includes(saved?.appearanceMode)) setAppearanceMode(saved.appearanceMode);
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    if (hydrated) saveThemePreferences({ accentName, accentChosen, appearanceMode }).catch(() => {});
  }, [accentName, accentChosen, appearanceMode, hydrated]);
  function chooseAccent(value: AccentName) {
    setAccentName(value);
    setAccentChosen(true);
  }
  const resolvedMode: AppearanceMode = appearanceMode;
  const theme = useMemo(() => {
    const accent =
      resolvedMode === "sepia"
        ? shade(accentColors[accentName], SEPIA_ACCENT_SHADE)
        : accentColors[accentName];
    return {
      ...palettes[resolvedMode],
      accent,
      /** The accent for text and small icons, which need more contrast than fills. */
      accentText: accent,
      /** Text and icons drawn on an accent fill. */
      onAccent: "#FFFFFF",
      logoWing: accent,
      playButton: accent,
      playIcon: "#FFFFFF",
      sentenceHighlight: withAlpha(accent, resolvedMode === "dark" ? "33" : "1F"),
      wordHighlight: withAlpha(accent, resolvedMode === "dark" ? "80" : "55"),
      mode: resolvedMode,
      isDark: resolvedMode === "dark",
    };
  }, [accentName, resolvedMode]);
  return (
    <C.Provider
      value={{
        accentName,
        setAccentName: chooseAccent,
        appearanceMode,
        setAppearanceMode,
        resolvedMode,
        theme,
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
