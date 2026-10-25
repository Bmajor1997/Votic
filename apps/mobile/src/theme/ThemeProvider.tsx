import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { load_theme_preferences, save_theme_preferences } from "../preferences/preferenceStorage";
export type AccentName = "blue" | "purple" | "pink" | "orange" | "green" | "graphite";
export type AppearanceMode = "light" | "dark" | "system";
export type ReaderAppearanceMode = "light" | "dark" | "sepia";
/**
 * Six clearly different accents. Each is dark enough for white text on buttons (at least 5:1), which keeps them in
 * one deep range, so there are few of them, and they are spread apart in hue and grey.
 */
export const accentColors: Record<AccentName, string> = {
  blue: "#2563EB",
  purple: "#9333EA",
  pink: "#BE185D",
  orange: "#C2410C",
  green: "#15803D",
  graphite: "#475569",
};
/** Accents earlier versions offered, moved to the closest current one so a saved choice keeps its look. */
const RETIRED_ACCENTS: Record<string, AccentName> = {
  indigo: "blue",
  red: "pink",
  rose: "pink",
  amber: "orange",
  teal: "green",
  emerald: "green",
};
export function current_accent(saved: unknown): AccentName | null {
  if (typeof saved !== "string") return null;
  const name = Object.hasOwn(RETIRED_ACCENTS, saved) ? RETIRED_ACCENTS[saved] : saved;
  return Object.hasOwn(accentColors, name) ? (name as AccentName) : null;
}
function with_alpha(hex: string, alpha: string) {
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
/** Blends two #RRGGBB colors: `amount` 0 is all `a`, 1 is all `b`. */
export function mix(a: string, b: string, amount: number) {
  const channel = (start: number) =>
    Math.round(
      parseInt(a.slice(start, start + 2), 16) * (1 - amount) +
        parseInt(b.slice(start, start + 2), 16) * amount,
    )
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
/**
 * The Reader's High contrast page: near-black (or white) text and visible borders on each paper, with body and
 * secondary text above 7:1 (WCAG AAA) so it is a real step up from the standard palettes, not just a darker tint.
 */
const highContrastPalettes = {
  light: {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceMuted: "#F2F2F2",
    text: "#000000",
    mutedText: "#2E2E2E",
    border: "#5C5C5C",
  },
  dark: {
    background: "#000000",
    surface: "#121212",
    surfaceMuted: "#1C1C1C",
    text: "#FFFFFF",
    mutedText: "#E0E0E0",
    border: "#8A8A8A",
  },
  sepia: {
    background: "#F4ECD8",
    surface: "#FBF5E6",
    surfaceMuted: "#EADFC6",
    text: "#21170F",
    mutedText: "#3B2C20",
    border: "#7D6B4F",
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
/** The page colors: High contrast for the Reader when asked, the paper palettes in the Reader and Sepia, else navigation. */
function page_palette(mode: ReaderAppearanceMode, reader: boolean, contrast: boolean) {
  if (contrast) return highContrastPalettes[mode];
  return reader || mode === "sepia" ? palettes[mode] : navigationPalettes[mode];
}
/** Accent-colored labels. On dark backgrounds (the Reader's included) they are lifted, or selected labels get hard to read. */
function accent_text(accent: string, mode: ReaderAppearanceMode, reader: boolean, contrast: boolean) {
  if (contrast) return mode === "dark" ? tint(accent, 0.7) : shade(accent, 0.35);
  if (mode === "dark") return tint(accent, reader ? 0.5 : 0.65);
  return reader ? accent : shade(accent, 0.12);
}
/** Small accent-colored text, such as links, that stays readable on dark backgrounds too. */
function link_text(accent: string, mode: ReaderAppearanceMode, contrast: boolean) {
  if (contrast) return mode === "dark" ? tint(accent, 0.7) : shade(accent, 0.35);
  return mode === "dark" ? tint(accent, 0.45) : accent;
}
export function make_theme(
  accentName: AccentName,
  resolvedMode: ReaderAppearanceMode,
  reader = false,
  highContrast = false,
) {
  const accent =
    resolvedMode === "sepia" ? shade(accentColors[accentName], SEPIA_ACCENT_SHADE) : accentColors[accentName];
  // High contrast only changes the Reader's page; the rest of Votic keeps its own palettes.
  const contrast = reader && highContrast;
  return {
    ...page_palette(resolvedMode, reader, contrast),
    accentText: accent_text(accent, resolvedMode, reader, contrast),
    linkText: link_text(accent, resolvedMode, contrast),
    onAccent: "#FFFFFF",
    aiStatusText: resolvedMode === "dark" ? "#C4A7EA" : resolvedMode === "sepia" ? "#704795" : "#7653A6",
    // Soft backgrounds behind icons and highlighted cards, made from the chosen accent so they change with it
    // (with blue they match Votic's original light blues and navies).
    brandTint: resolvedMode === "dark" ? mix("#152238", accent, 0.25) : mix("#FFFFFF", accent, 0.12),
    hero: resolvedMode === "dark" ? mix("#0B1220", accent, 0.3) : mix("#FFFFFF", accent, 0.16),
    heroText: resolvedMode === "dark" ? "#F2F6FF" : shade(accent, 0.55),
    heroMuted: resolvedMode === "dark" ? tint(accent, 0.7) : mix("#53637B", accent, 0.3),
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
    sentenceHighlight: with_alpha(accent, resolvedMode === "dark" ? "33" : "1F"),
    wordHighlight: with_alpha(accent, resolvedMode === "dark" ? "80" : "55"),
    mode: resolvedMode,
    isDark: resolvedMode === "dark",
    highContrast: contrast,
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
    load_theme_preferences().then((saved) => {
      // Earlier versions saved their orange default without anyone choosing it. Only a color that was
      // actually picked in Settings (or any color other than that old default) is kept.
      const chosen = saved?.accentChosen === true || (saved?.accentName && saved.accentName !== "orange");
      const accent = current_accent(saved?.accentName);
      if (chosen && accent) {
        setAccentName(accent);
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
  useEffect(() => {
    if (hydrated)
      save_theme_preferences({ accentName, accentChosen, appearanceMode, readerAppearanceMode }).catch(
        () => {},
      );
  }, [accentName, accentChosen, appearanceMode, readerAppearanceMode, hydrated]);
  function choose_accent(value: AccentName) {
    setAccentName(value);
    setAccentChosen(true);
  }
  const resolvedMode =
    appearanceMode === "system" ? (systemMode === "dark" ? "dark" : "light") : appearanceMode;
  const theme = useMemo(() => make_theme(accentName, resolvedMode), [accentName, resolvedMode]);
  return (
    <C.Provider
      value={{
        accentName,
        setAccentName: choose_accent,
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
        sentenceHighlight: with_alpha(SETUP_ACCENT, dark ? "33" : "24"),
        wordHighlight: with_alpha(SETUP_ACCENT, dark ? "80" : "66"),
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
  const { highContrast } = useAccessibilityPreferences();
  const resolvedMode = app.readerAppearanceMode ?? app.resolvedMode;
  const theme = useMemo(
    () => make_theme(app.accentName, resolvedMode, true, highContrast),
    [app.accentName, resolvedMode, highContrast],
  );
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
