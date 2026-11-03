import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { useCallback, useEffect, useRef } from "react";
import { useActivity } from "../activity/ActivityProvider";
import { active_day_set } from "../activity/activityModel";
import { useAccountData } from "../storage/AccountDataProvider";
import { account_storage_key } from "../storage/accountStorage";
import { useOptionalWalkthrough } from "../walkthrough/WalkthroughProvider";
import { STORE_REVIEW_KEY, parse_review_state, review_due } from "./storeReview";

/** Lets the Reader finish closing before the store's card appears. */
export const REVIEW_DELAY_MS = 1_500;

/**
 * Returns `afterReading`, which the Reader's activity tracker calls when the Reader closes. If the moment is right (see storeReview.ts), the
 * store is asked for its review card a moment later. Nothing is asked while a walkthrough is showing.
 */
export function useStoreReviewPrompt() {
  const { measuredLog, hydrated } = useActivity();
  const { uid } = useAccountData();
  const walkthrough = useOptionalWalkthrough();
  const latest = useRef({ measuredLog, hydrated, uid, walkthroughActive: Boolean(walkthrough?.active) });
  useEffect(() => {
    latest.current = { measuredLog, hydrated, uid, walkthroughActive: Boolean(walkthrough?.active) };
  });

  return useCallback(() => {
    const { measuredLog: log, hydrated: ready, uid: account } = latest.current;
    if (!ready || !account) return;
    const activeDays = active_day_set(log).size;
    const key = account_storage_key(STORE_REVIEW_KEY, account);
    void (async () => {
      try {
        const state = parse_review_state(await AsyncStorage.getItem(key));
        const now = Date.now();
        if (!review_due(state, activeDays, now)) return;
        await new Promise((resolve) => setTimeout(resolve, REVIEW_DELAY_MS));
        if (latest.current.uid !== account || latest.current.walkthroughActive) return;
        if (!(await StoreReview.isAvailableAsync())) return;
        // Recorded first, so a store that fails or never shows its card isn't asked again on every close.
        await AsyncStorage.setItem(key, JSON.stringify({ asks: state.asks + 1, lastAskedAt: now }));
        await StoreReview.requestReview();
      } catch {
        // A review card is never worth an error message.
      }
    })();
  }, []);
}
