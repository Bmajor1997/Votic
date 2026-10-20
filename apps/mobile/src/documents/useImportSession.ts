import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAccountData } from "../storage/AccountDataProvider";
import { account_writable } from "../storage/accountDeletion";

/**
 * One import per screen. Leaving, backgrounding or deleting the account invalidates late results, except
 * while Votic itself has sent people elsewhere: on Android the system file picker backgrounds the app, and
 * that must not cancel the import it is choosing a file for (`job.away`).
 */
export function useImportSession(onLeave?: () => void) {
  const { uid } = useAccountData();
  const controller = useRef<AbortController | null>(null);
  const focused = useRef(false);
  const leave = useRef(onLeave);
  const away = useRef(0);
  useEffect(() => {
    leave.current = onLeave;
  }, [onLeave]);
  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        cancel();
        leave.current?.();
      };
    }, [cancel]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && away.current === 0) cancel();
    });
    return () => subscription.remove();
  }, [cancel]);
  return {
    active: () => focused.current && account_writable(uid),
    start() {
      if (controller.current || !focused.current || !account_writable(uid)) return null;
      const next = new AbortController();
      controller.current = next;
      return {
        signal: next.signal,
        current: () =>
          focused.current && !next.signal.aborted && controller.current === next && account_writable(uid),
        /** Runs a system screen (such as the file picker) without backgrounding counting as leaving. */
        away: async <T>(work: () => Promise<T>) => {
          away.current += 1;
          try {
            return await work();
          } finally {
            away.current -= 1;
          }
        },
        finish: () => {
          if (controller.current === next) controller.current = null;
        },
      };
    },
  };
}
