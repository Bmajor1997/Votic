import { useLayoutEffect, useRef } from "react";

/**
 * Whether the Reader has opened at the saved position yet. Read and Listen use different pages, so switching
 * to Listen after the Read page was prepared marks the Listen page to scroll to the saved sentence once its
 * sentences are measured, instead of opening at the top of the document.
 */
export function useReaderPreparation(listening: boolean) {
  const readerPrepared = useRef(false);
  const listenScrollPending = useRef(false);
  useLayoutEffect(() => {
    if (listening && readerPrepared.current) listenScrollPending.current = true;
  }, [listening]);
  return { readerPrepared, listenScrollPending };
}
