import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { useDocumentTransition } from "../navigation/DocumentTransitionProvider";
import { useWalkthrough } from "../walkthrough/WalkthroughProvider";
import { useAccountSetup } from "./AccountSetupProvider";

/** A moment after coming back from the Reader, so the document's closing has finished first. */
const AFTER_READER_MS = 600;

/**
 * Shows the Home Screen widgets screen once, after this account's first document: when the app comes back from the
 * Reader having read or listened to part of one. Never over a walkthrough tip or a document transition.
 */
export function useWidgetsTip() {
  const { widgetsLater } = useAccountSetup();
  const { documents } = useDocumentLibrary();
  const { active } = useWalkthrough();
  const { transitioning } = useDocumentTransition();
  // Read or listened to some of it, not just imported it.
  const opened = documents.some((document) => document.progress > 0 || document.wordIndex > 0);
  const shown = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!widgetsLater || !opened || active || transitioning || shown.current) return;
      const timer = setTimeout(() => {
        shown.current = true;
        router.push("/widgets-tip");
      }, AFTER_READER_MS);
      return () => clearTimeout(timer);
    }, [widgetsLater, opened, active, transitioning]),
  );
}
