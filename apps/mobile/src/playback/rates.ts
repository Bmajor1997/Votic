export const MIN_PLAYBACK_RATE = 0.5;
export const MAX_PLAYBACK_RATE = 4;
export const PLAYBACK_RATE_STEP = 0.1;
export const PLAYBACK_RATES = Array.from(
  { length: Math.round((MAX_PLAYBACK_RATE - MIN_PLAYBACK_RATE) / PLAYBACK_RATE_STEP) + 1 },
  (_, index) => Number((MIN_PLAYBACK_RATE + index * PLAYBACK_RATE_STEP).toFixed(1)),
);
export function normalizePlaybackRate(value: number) {
  const clamped = Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, Number(value) || 1));
  return Number((Math.round(clamped / PLAYBACK_RATE_STEP) * PLAYBACK_RATE_STEP).toFixed(1));
}
export function formatPlaybackRate(value: number) {
  return normalizePlaybackRate(value).toFixed(1) + "×";
}
