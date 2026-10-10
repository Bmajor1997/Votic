import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useActivity } from "../activity/ActivityProvider";
import { useAuth } from "../auth/AuthProvider";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { publishWidgetSnapshot } from "./widgetBridge";
import { buildWidgetSnapshot } from "./widgetSnapshot";

/** Waits for a burst of changes (progress while reading, time while listening) to settle. */
export const WIDGET_PUBLISH_DELAY_MS = 2000;

/**
 * Keeps the home-screen widgets in step with the library and reading time. Renders nothing.
 *
 * Nothing is sent until sign-in, the library, and activity have loaded, so a widget never flashes an
 * empty library while Votic starts. Signing out clears the widgets right away. Unchanged snapshots aren't
 * resent, and a pending update is sent before Votic goes to the background.
 */
export function WidgetSync({ publish = publishWidgetSnapshot }: { publish?: (snapshot: string) => void }) {
  const { documents, loaded } = useDocumentLibrary();
  const { measuredLog, hydrated } = useActivity();
  const { user, hydrated: authKnown } = useAuth();
  const signedIn = Boolean(user);
  const lastSent = useRef<string | null>(null);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Until sign-in is known, "no user" doesn't mean signed out.
    if (!authKnown || (signedIn && (!loaded || !hydrated))) return;
    const send = () => {
      pending.current = null;
      const snapshot = JSON.stringify(buildWidgetSnapshot({ documents, log: measuredLog, signedIn }));
      if (snapshot === lastSent.current) return;
      lastSent.current = snapshot;
      publish(snapshot);
    };
    if (!signedIn) {
      send();
      return;
    }
    pending.current = send;
    const timer = setTimeout(send, WIDGET_PUBLISH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      pending.current = null;
    };
  }, [documents, measuredLog, signedIn, authKnown, loaded, hydrated, publish]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") pending.current?.();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
