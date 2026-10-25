/** How long a passage may take to start speaking before Votic reports that the reading voice didn't start. */
export const SPEECH_START_TIMEOUT_MS = 10_000;

/**
 * Calls `onFail` if speech hasn't started (or ended) within the timeout. The device's speech engine can reject a
 * request without any callback, so this is how Votic notices and tells the listener rather than staying silent.
 */
export function speech_start_guard(onFail: () => void, timeoutMs = SPEECH_START_TIMEOUT_MS) {
  let settled = false;
  const timer = setTimeout(() => {
    if (!settled) onFail();
  }, timeoutMs);
  return {
    started() {
      settled = true;
      clearTimeout(timer);
    },
  };
}
