import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { BrandMark, useMarkFlight } from "../onboarding/WelcomeMotion";
import { useVoticTheme } from "../theme/ThemeProvider";

type Welcome = { title: string; detail: string };

/** How long the welcome stays still before the V flies off: long enough to read and to be announced. */
const PAUSE_MS = 700;
const PAUSE_REDUCED_MS = 1200;
/** Whatever happens to the animation, the new subscriber is let in by then. */
const LONGEST_MS = 2600;

/**
 * A short welcome after a confirmed purchase or restore: the V from the welcome screen appears, then its
 * pieces fly off, as they do when someone first signs in. With Less motion the V stays still. `celebrate`
 * resolves when it's time to open Votic, and always resolves, so a lost animation can never strand a subscriber.
 */
export function usePurchaseCelebration() {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const { fly, flight, cancel } = useMarkFlight();
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pending = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      cancel();
      pending.current?.();
    },
    [cancel],
  );

  const celebrate = useCallback(
    (next: Welcome) =>
      new Promise<void>((resolve) => {
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          pending.current = null;
          resolve();
        };
        pending.current = done;
        setWelcome(next);
        AccessibilityInfo.announceForAccessibility(`${next.title} ${next.detail}`);
        timers.current.push(
          setTimeout(() => fly(done), reduceMotion ? PAUSE_REDUCED_MS : PAUSE_MS),
          setTimeout(done, LONGEST_MS),
        );
      }),
    [fly, reduceMotion],
  );

  const overlay = welcome ? (
    <View
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, s.overlay, { backgroundColor: theme.background }]}
    >
      <BrandMark size={120} flight={flight} />
      <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
        {welcome.title}
      </Text>
      <Text style={[s.detail, { color: theme.mutedText }]}>{welcome.detail}</Text>
    </View>
  ) : null;

  return { celebrate, overlay };
}

const s = StyleSheet.create({
  overlay: { alignItems: "center", justifyContent: "center", gap: 18, padding: 32, zIndex: 10 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8, textAlign: "center" },
  detail: { fontSize: 17, lineHeight: 25, textAlign: "center" },
});
