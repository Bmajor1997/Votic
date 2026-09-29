import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { loadThemePreferences, saveThemePreferences } from "../preferences/preferenceStorage";
export type AccentName =
  "blue" | "purple" | "orange" | "red" | "teal" | "emerald" | "indigo" | "rose" | "amber";
export type AppearanceMode = "light" | "dark" | "system";
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
} as const;
const C = createContext<any>(null);
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [accentName, setAccentName] = useState<AccentName>("orange");
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>("light");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    loadThemePreferences().then((saved) => {
      if (saved?.accentName && saved.accentName in accentColors) setAccentName(saved.accentName);
      if (["light", "dark", "system"].includes(saved?.appearanceMode))
        setAppearanceMode(saved.appearanceMode);
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    if (hydrated) saveThemePreferences({ accentName, appearanceMode }).catch(() => {});
  }, [accentName, appearanceMode, hydrated]);
  const resolvedMode: Exclude<AppearanceMode, "system"> =
    appearanceMode === "system" ? (system === "dark" ? "dark" : "light") : appearanceMode;
  const theme = useMemo(() => {
    const accent = accentColors[accentName];
    return {
      ...palettes[resolvedMode],
      accent,
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
    <C.Provider value={{ accentName, setAccentName, appearanceMode, setAppearanceMode, resolvedMode, theme }}>
      {children}
    </C.Provider>
  );
}
export function useVoticTheme() {
  const c = useContext(C);
  if (!c) throw new Error("useVoticTheme must be used inside ThemeProvider");
  return c;
}
