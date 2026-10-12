import { AppState, Platform } from "react-native";
import type { AccentName } from "./ThemeProvider";

type IconModule = {
  supportsAlternateIcons: boolean;
  getAppIconName: () => string | null;
  setAlternateAppIcon: (name: string | null) => Promise<string | null>;
};

/** The home-screen icon for an accent: blue is the main icon; every other accent has its own (see app.json). */
export function appIconFor(accent: AccentName): string | null {
  return accent === "blue" ? null : accent[0].toUpperCase() + accent.slice(1);
}

function iconModule(): IconModule | null {
  if (Platform.OS === "web") return null;
  try {
    // Native code that only exists in builds made after it was added; Expo Go and older builds skip it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("expo-alternate-app-icons") as IconModule;
    return module.supportsAlternateIcons ? module : null;
  } catch {
    return null;
  }
}

let pending: string | null | undefined;
let waiting: { remove: () => void } | null = null;

async function apply(icon: string | null) {
  const module = iconModule();
  if (!module) return;
  try {
    if (module.getAppIconName() !== icon) await module.setAlternateAppIcon(icon);
  } catch {
    // The icon is a nicety; the app keeps working with whichever icon it has.
  }
}

/**
 * Matches the phone's home-screen icon to the accent color. On iPhone it changes right away (iOS shows its
 * own short notice). On Android it waits until Votic is in the background, because switching icons there can
 * close the app; the new icon is in place the next time the person sees their home screen.
 */
export function matchAppIcon(accent: AccentName) {
  const icon = appIconFor(accent);
  if (Platform.OS !== "android") {
    void apply(icon);
    return;
  }
  pending = icon;
  if (waiting) return;
  waiting = AppState.addEventListener("change", (state) => {
    if (state !== "background" || pending === undefined) return;
    const next = pending;
    pending = undefined;
    waiting?.remove();
    waiting = null;
    void apply(next);
  });
}
