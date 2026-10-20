import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useActivity } from "../activity/ActivityProvider";
import { useAuth } from "../auth/AuthProvider";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { account_writable } from "../storage/accountDeletion";
import { publish_widget_snapshot } from "./widgetBridge";
import { build_widget_snapshot } from "./widgetSnapshot";

/** Waits for a burst of changes (progress while reading, time while listening) to settle. */
export const WIDGET_PUBLISH_DELAY_MS = 2000;

/**
 * Keeps the home-screen widgets in step with the library and reading time. Renders nothing.
 *
 * Nothing is sent until sign-in, the library, and activity have loaded, so a widget never flashes an
 * empty library while Votic starts. Signing out clears the widgets right away. Unchanged snapshots aren't
 * resent, and a pending update is sent before Votic goes to the background.
 */
export function WidgetSync({ publish = publish_widget_snapshot }: { publish?: (snapshot: string) => void }) {
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
      // A delayed send may outlive the deletion confirmation and its explicit widget clear.
      const snapshot = JSON.stringify(
        build_widget_snapshot({
          documents,
          log: measuredLog,
          signedIn: signedIn && account_writable(user?.uid),
        }),
      );
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
  }, [documents, measuredLog, signedIn, authKnown, loaded, hydrated, publish, user?.uid]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") pending.current?.();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
